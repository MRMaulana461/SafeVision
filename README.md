# SafeVision — Realtime PPE Compliance Scanner (Client-Side)

Web app deteksi APD (Alat Pelindung Diri) realtime lewat webcam. Model YOLO
kamu jalan **langsung di browser** (JavaScript, via ONNX Runtime Web) — **tidak
ada backend server**. Cukup deploy 1 app statis ke **GitHub Pages**.

```
safevision/
├── .github/workflows/deploy.yml   Auto-deploy ke GitHub Pages tiap push
├── backend/                        (LEGACY, tidak dipakai lagi — lihat catatan di bawah)
└── frontend/
    ├── public/models/best.onnx     <- TARUH MODEL ONNX KAMU DI SINI
    └── src/
        ├── inference/yolo.js       Preprocessing + forward pass + NMS (semua di JS)
        ├── config.js                Nama kelas, threshold, dll — WAJIB disesuaikan
        └── components/WebcamFeed.jsx
```

> **Catatan soal folder `backend/`**: itu peninggalan dari versi awal (Flask API).
> Sekarang tidak dipakai untuk deployment sama sekali — tapi tetap berguna
> karena venv-nya berisi `ultralytics`, yang kamu pakai untuk **export model
> ke ONNX** (lihat langkah 1 di bawah).

---

## 1. Export model ke ONNX (kalau belum)

Di folder `backend`, dengan venv aktif:

```powershell
cd backend
venv\Scripts\Activate.ps1
yolo export model=weights/best.pt format=onnx opset=12 simplify=True
```

Ini menghasilkan `backend/weights/best.onnx`.

## 2. Cek nama-nama kelas model kamu

```powershell
python -c "from ultralytics import YOLO; print(YOLO('weights/best.pt').names)"
```

Output-nya berupa dict, contoh: `{0: 'Hardhat', 1: 'Mask', 2: 'NO-Hardhat', ...}`.
**Urutan index ini penting** — harus cocok persis dengan array `CLASS_NAMES` di
`frontend/src/config.js`.

## 3. Taruh model & sesuaikan config

Copy model ke folder public frontend:

```powershell
cd ..\frontend
Copy-Item ..\backend\weights\best.onnx public\models\best.onnx
```

Buka `frontend/src/config.js`, edit dua hal:
- `CLASS_NAMES` — urutkan sesuai hasil langkah 2
- `VIOLATION_KEYWORDS` — kata kunci yang menandakan "pelanggaran" (default:
  kelas yang namanya mengandung `no-`, `no_`, `without`, dst — sesuaikan kalau
  penamaan kelas kamu beda)

## 4. Coba jalankan lokal dulu

```powershell
npm install
npm run dev
```

Buka `http://localhost:5173`, klik **Mulai pemindaian**, izinkan akses kamera.
Kalau bounding box muncul dengan benar → siap deploy.

---

## 5. Push ke GitHub

Dari folder root project (`safevision/`, yang berisi `.github/`, `backend/`,
`frontend/`):

```powershell
cd ..
git init
git add .
git commit -m "SafeVision client-side PPE detection"
git branch -M main
git remote add origin https://github.com/USERNAME/safevision.git
git push -u origin main
```

> Model `.onnx` biasanya puluhan MB. Kalau di atas ~90MB, GitHub akan menolak
> push kecuali pakai Git LFS:
> ```powershell
> git lfs install
> git lfs track "*.onnx"
> git add .gitattributes
> ```
> (jalankan sebelum `git add .` di atas)

## 6. Aktifkan GitHub Pages

1. Buka repo kamu di GitHub → **Settings** → **Pages**
2. Di **Build and deployment** → **Source**, pilih **GitHub Actions**
   (bukan "Deploy from a branch")
3. Selesai — workflow di `.github/workflows/deploy.yml` akan otomatis jalan
   tiap kali kamu push ke `main`. Cek progressnya di tab **Actions** repo kamu.

Setelah workflow selesai (centang hijau), app kamu live di:

```
https://USERNAME.github.io/safevision/
```

---

## 7. Update selanjutnya

Setiap kali kamu `git push` ke `main`, GitHub Actions otomatis build ulang dan
publish versi terbaru. Tidak perlu langkah manual apapun lagi.

---

## Kustomisasi cepat

| Ingin ubah...                    | Di mana                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------|
| Nama kelas / urutan               | `frontend/src/config.js` → `CLASS_NAMES`                                          |
| Kata kunci kelas "pelanggaran"    | `frontend/src/config.js` → `VIOLATION_KEYWORDS`                                   |
| Confidence / IoU threshold        | `frontend/src/config.js` (atau env `VITE_CONF_THRESHOLD`, `VITE_IOU_THRESHOLD`)  |
| Seberapa sering inference jalan   | `frontend/src/config.js` → `INFERENCE_INTERVAL_MS`                                |
| Warna & tampilan                  | `frontend/src/index.css`, `App.css`                                               |

---

## Troubleshooting

- **"Gagal memuat model ONNX"**: pastikan `frontend/public/models/best.onnx`
  benar-benar ada sebelum `npm run build` / push. File ini tidak boleh
  ke-`.gitignore`.
- **Kamera tidak muncul**: GitHub Pages otomatis `https://`, jadi harusnya
  aman. Kalau tetap gagal, cek izin kamera di browser.
- **Deteksi lambat / browser berat**: model YOLO11s cukup ringan, tapi kalau
  device lemah, naikkan `INFERENCE_INTERVAL_MS` di `config.js` (misal ke
  `800` atau `1000`).
- **Bounding box salah tempat / label salah**: hampir pasti `CLASS_NAMES` di
  `config.js` urutannya tidak cocok dengan model kamu — cek ulang langkah 2.
- **GitHub Actions gagal di step build**: buka tab **Actions** → klik run yang
  gagal → baca log. Biasanya soal `package-lock.json` tidak ikut ter-commit
  (pastikan file itu ada di `frontend/package-lock.json` dan ikut di-push).
