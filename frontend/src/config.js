// =============================================================================
// KONFIGURASI MODEL — WAJIB DISESUAIKAN DENGAN MODEL KAMU
// =============================================================================

// Path ke file .onnx (ditaruh di folder /public, lihat README).
export const MODEL_URL = `${import.meta.env.BASE_URL}models/best.onnx`

// !! GANTI SESUAI URUTAN KELAS MODEL KAMU !!
// Cek urutan aslinya dengan (di folder backend, venv aktif):
//   python -c "from ultralytics import YOLO; print(YOLO('weights/best.pt').names)"
// Urutan index HARUS SAMA PERSIS dengan output dict itu (index 0, 1, 2, ...).
// Ini nilai sementara berdasarkan dataset "Construction Site Safety" (Roboflow) —
// SESUAIKAN kalau berbeda.
export const CLASS_NAMES = [
  'Hardhat',
  'Mask',
  'NO-Hardhat',
  'NO-Mask',
  'NO-Safety Vest',
  'Person',
  'Safety Cone',
  'Safety Vest',
  'machinery',
  'vehicle',
]

// Kelas yang dianggap PELANGGARAN jika nama kelas mengandung salah satu kata ini
// (case-insensitive). Sesuaikan dengan nama kelas model kamu jika perlu.
export const VIOLATION_KEYWORDS = ['no-', 'no_', 'without', 'missing', 'not-wearing']

// =============================================================================
// KONFIGURASI INFERENCE
// =============================================================================

// Confidence threshold (0-1). Naikkan kalau terlalu banyak false positive.
export const CONF_THRESHOLD = Number(import.meta.env.VITE_CONF_THRESHOLD) || 0.4

// IoU threshold untuk Non-Max Suppression.
export const IOU_THRESHOLD = Number(import.meta.env.VITE_IOU_THRESHOLD) || 0.45

// Jeda antar-inference (ms). Turunkan untuk lebih realtime (kalau device kuat),
// naikkan kalau device/browser terasa berat.
export const INFERENCE_INTERVAL_MS = Number(import.meta.env.VITE_INFERENCE_INTERVAL_MS) || 400
