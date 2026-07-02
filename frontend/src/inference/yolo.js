import * as ort from 'onnxruntime-web'

// ONNX Runtime Web butuh file .wasm — kita ambil dari CDN jsdelivr, versi harus
// sama persis dengan versi package onnxruntime-web di package.json.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'

const INPUT_SIZE = 640

let sessionPromise = null

/**
 * Memuat model ONNX sekali saja (di-cache sebagai singleton promise).
 */
export function getSession(modelUrl) {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  }
  return sessionPromise
}

/**
 * Letterbox resize: skala gambar supaya pas di kotak INPUT_SIZE x INPUT_SIZE
 * sambil mempertahankan aspect ratio, sisa area diisi warna abu-abu (114).
 * Mengembalikan tensor Float32 siap pakai + info untuk mapping balik koordinat box.
 */
function preprocess(sourceCanvasOrVideo, srcW, srcH) {
  const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH)
  const newW = Math.round(srcW * scale)
  const newH = Math.round(srcH * scale)
  const padX = Math.floor((INPUT_SIZE - newW) / 2)
  const padY = Math.floor((INPUT_SIZE - newH) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = INPUT_SIZE
  canvas.height = INPUT_SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE)
  ctx.drawImage(sourceCanvasOrVideo, 0, 0, srcW, srcH, padX, padY, newW, newH)

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const float32 = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  const area = INPUT_SIZE * INPUT_SIZE
  // HWC RGBA -> CHW RGB, normalisasi 0-1
  for (let i = 0; i < area; i++) {
    float32[i] = data[i * 4] / 255 // R
    float32[area + i] = data[i * 4 + 1] / 255 // G
    float32[2 * area + i] = data[i * 4 + 2] / 255 // B
  }

  const tensor = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE])
  return { tensor, scale, padX, padY, srcW, srcH }
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0])
  const y1 = Math.max(a[1], b[1])
  const x2 = Math.min(a[2], b[2])
  const y2 = Math.min(a[3], b[3])
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const areaA = (a[2] - a[0]) * (a[3] - a[1])
  const areaB = (b[2] - b[0]) * (b[3] - b[1])
  return inter / (areaA + areaB - inter + 1e-6)
}

function nms(boxes, scores, iouThreshold) {
  const order = scores.map((s, i) => i).sort((i, j) => scores[j] - scores[i])
  const keep = []
  const suppressed = new Set()

  for (const i of order) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (j === i || suppressed.has(j)) continue
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed.add(j)
    }
  }
  return keep
}

/**
 * Decode output mentah YOLO11/YOLOv8: shape [1, 4+numClasses, 8400]
 * (format "features-first"), lakukan filtering confidence + NMS per kelas,
 * lalu kembalikan koordinat box dalam ruang gambar ASLI (bukan 640x640).
 */
function postprocess(output, meta, classNames, confThreshold, iouThreshold) {
  const dims = output.dims // [1, 4+nc, 8400]
  const numAttrs = dims[1]
  const numBoxes = dims[2]
  const numClasses = numAttrs - 4
  const data = output.data

  const candBoxes = []
  const candScores = []
  const candClassIds = []

  for (let i = 0; i < numBoxes; i++) {
    let bestScore = 0
    let bestClass = -1
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numBoxes + i]
      if (score > bestScore) {
        bestScore = score
        bestClass = c
      }
    }
    if (bestScore < confThreshold) continue

    const cx = data[0 * numBoxes + i]
    const cy = data[1 * numBoxes + i]
    const w = data[2 * numBoxes + i]
    const h = data[3 * numBoxes + i]

    // Koordinat masih dalam ruang 640x640 (dengan letterbox padding)
    let x1 = cx - w / 2
    let y1 = cy - h / 2
    let x2 = cx + w / 2
    let y2 = cy + h / 2

    // Balikkan letterbox: kurangi padding, bagi scale, dapat koordinat gambar asli
    x1 = (x1 - meta.padX) / meta.scale
    y1 = (y1 - meta.padY) / meta.scale
    x2 = (x2 - meta.padX) / meta.scale
    y2 = (y2 - meta.padY) / meta.scale

    // Clamp ke batas gambar
    x1 = Math.max(0, Math.min(meta.srcW, x1))
    y1 = Math.max(0, Math.min(meta.srcH, y1))
    x2 = Math.max(0, Math.min(meta.srcW, x2))
    y2 = Math.max(0, Math.min(meta.srcH, y2))

    candBoxes.push([x1, y1, x2, y2])
    candScores.push(bestScore)
    candClassIds.push(bestClass)
  }

  // NMS per kelas (supaya box kelas berbeda yang tumpang tindih tidak saling menghapus)
  const keepIndices = []
  const uniqueClasses = [...new Set(candClassIds)]
  for (const cls of uniqueClasses) {
    const idxs = candClassIds.map((c, i) => (c === cls ? i : -1)).filter((i) => i !== -1)
    const boxesForClass = idxs.map((i) => candBoxes[i])
    const scoresForClass = idxs.map((i) => candScores[i])
    const kept = nms(boxesForClass, scoresForClass, iouThreshold)
    kept.forEach((k) => keepIndices.push(idxs[k]))
  }

  return keepIndices.map((i) => ({
    class_id: candClassIds[i],
    class_name: classNames[candClassIds[i]] ?? String(candClassIds[i]),
    confidence: Math.round(candScores[i] * 1000) / 1000,
    box: candBoxes[i],
  }))
}

/**
 * Fungsi utama: ambil frame dari <video>/<canvas>, jalankan model, kembalikan deteksi.
 */
export async function detectFrame(session, sourceEl, srcW, srcH, classNames, confThreshold, iouThreshold) {
  const { tensor, ...meta } = preprocess(sourceEl, srcW, srcH)
  const feeds = { [session.inputNames[0]]: tensor }
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]]
  return postprocess(output, meta, classNames, confThreshold, iouThreshold)
}
