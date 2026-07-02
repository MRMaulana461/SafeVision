import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CLASS_NAMES,
  CONF_THRESHOLD,
  INFERENCE_INTERVAL_MS,
  IOU_THRESHOLD,
  MODEL_URL,
} from '../config.js'
import { getSession, detectFrame } from '../inference/yolo.js'
import { colorForClass, formatConfidence } from '../utils/detections.js'
import './WebcamFeed.css'

// idle -> loading-model -> starting -> live
//                                   \-> error
export default function WebcamFeed({ onDetections, onLatency, onStatusChange }) {
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const intervalRef = useRef(null)
  const inFlightRef = useRef(false)
  const sessionRef = useRef(null)

  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [aspect, setAspect] = useState(16 / 9)

  const setStatusBoth = useCallback(
    (s) => {
      setStatus(s)
      onStatusChange?.(s)
    },
    [onStatusChange],
  )

  const drawOverlay = useCallback((detections, canvasW, canvasH) => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvasW, canvasH)

    detections.forEach((det) => {
      const [x1, y1, x2, y2] = det.box
      const rw = x2 - x1
      const rh = y2 - y1
      const color = colorForClass(det.class_name)
      const label = `${det.class_name} ${formatConfidence(det.confidence)}`

      ctx.lineWidth = Math.max(2, canvasW * 0.0035)
      ctx.strokeStyle = color
      ctx.strokeRect(x1, y1, rw, rh)

      ctx.font = `600 ${Math.max(13, canvasW * 0.018)}px "IBM Plex Mono", monospace`
      const textW = ctx.measureText(label).width
      const padX = 6
      const tagH = Math.max(18, canvasW * 0.026)
      ctx.fillStyle = color
      ctx.fillRect(x1 - ctx.lineWidth / 2, Math.max(0, y1 - tagH), textW + padX * 2, tagH)
      ctx.fillStyle = '#0a0d0f'
      ctx.fillText(label, x1 - ctx.lineWidth / 2 + padX, Math.max(tagH - 5, y1 - 6))
    })
  }, [])

  const runDetection = useCallback(async () => {
    if (inFlightRef.current) return
    const video = videoRef.current
    const session = sessionRef.current
    if (!video || !session || video.readyState < 2) return

    inFlightRef.current = true
    const t0 = performance.now()
    try {
      const detections = await detectFrame(
        session,
        video,
        video.videoWidth,
        video.videoHeight,
        CLASS_NAMES,
        CONF_THRESHOLD,
        IOU_THRESHOLD,
      )
      const latency = Math.round(performance.now() - t0)
      onLatency?.(latency)
      drawOverlay(detections, overlayRef.current.width, overlayRef.current.height)
      onDetections?.(detections)
      setErrorMsg('')
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Gagal menjalankan inference')
      setStatusBoth('error')
    } finally {
      inFlightRef.current = false
    }
  }, [drawOverlay, onDetections, onLatency, setStatusBoth])

  const startCamera = useCallback(async () => {
    setErrorMsg('')

    // 1. Muat model dulu (sekali saja, di-cache oleh getSession)
    if (!sessionRef.current) {
      setStatusBoth('loading-model')
      try {
        sessionRef.current = await getSession(MODEL_URL)
      } catch (err) {
        console.error(err)
        setErrorMsg(
          `Gagal memuat model ONNX dari ${MODEL_URL}. Pastikan file best.onnx ada di folder public/models/. Detail: ${err.message}`,
        )
        setStatusBoth('error')
        return
      }
    }

    // 2. Aktifkan kamera
    setStatusBoth('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      const vw = video.videoWidth
      const vh = video.videoHeight
      setAspect(vw / vh || 16 / 9)
      const overlay = overlayRef.current
      overlay.width = vw
      overlay.height = vh

      intervalRef.current = setInterval(runDetection, INFERENCE_INTERVAL_MS)
      setStatusBoth('live')
    } catch (err) {
      setErrorMsg(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Aktifkan akses kamera di browser lalu coba lagi.'
          : err.message || 'Tidak bisa mengakses kamera',
      )
      setStatusBoth('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runDetection])

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current)
    const video = videoRef.current
    const stream = video?.srcObject
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
    setStatusBoth('idle')
  }, [setStatusBoth])

  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isLive = status === 'live'
  const isBusy = status === 'loading-model' || status === 'starting'

  return (
    <div className="feed">
      <div className="feed__viewport" style={{ aspectRatio: aspect }}>
        <video ref={videoRef} className="feed__video" playsInline muted />
        <canvas ref={overlayRef} className="feed__overlay" />

        <span className="feed__bracket feed__bracket--tl" />
        <span className="feed__bracket feed__bracket--tr" />
        <span className="feed__bracket feed__bracket--bl" />
        <span className="feed__bracket feed__bracket--br" />

        {isLive && <div className="feed__scanline" />}

        {!isLive && (
          <div className="feed__placeholder">
            {status === 'idle' && (
              <>
                <p className="feed__placeholder-title">SCANNER STANDBY</p>
                <button className="btn btn--primary" onClick={startCamera}>
                  Mulai pemindaian
                </button>
              </>
            )}
            {status === 'loading-model' && <p className="feed__placeholder-title">MEMUAT MODEL AI…</p>}
            {status === 'starting' && <p className="feed__placeholder-title">MENGAKTIFKAN KAMERA…</p>}
            {status === 'error' && (
              <>
                <p className="feed__placeholder-title feed__placeholder-title--error">SCANNER ERROR</p>
                <p className="feed__error-msg">{errorMsg}</p>
                <button className="btn btn--primary" onClick={startCamera}>
                  Coba lagi
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isLive && (
        <button className="btn btn--ghost feed__stop" onClick={stopCamera}>
          Hentikan pemindaian
        </button>
      )}
      {isBusy && (
        <p className="feed__hint">
          Semua deteksi berjalan langsung di browser kamu — tidak ada data yang dikirim ke server manapun.
        </p>
      )}
      {status === 'error' && errorMsg && (
        <p className="feed__error-msg feed__error-msg--inline">{errorMsg}</p>
      )}
    </div>
  )
}
