import base64
import io
import os
import time

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Konfigurasi
# ---------------------------------------------------------------------------
MODEL_PATH = os.environ.get("MODEL_PATH", "weights/best.pt")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")  # set ke URL Vercel saat production
CONF_THRESHOLD = float(os.environ.get("CONF_THRESHOLD", 0.4))
IOU_THRESHOLD = float(os.environ.get("IOU_THRESHOLD", 0.45))
MAX_IMAGE_SIDE = int(os.environ.get("MAX_IMAGE_SIDE", 960))  # resize biar inference cepat

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": FRONTEND_ORIGIN}})

print(f"[SafeVision] Memuat model dari: {MODEL_PATH}")
model = YOLO(MODEL_PATH)
CLASS_NAMES = model.names
print(f"[SafeVision] Model siap. Kelas: {CLASS_NAMES}")


def _resize_if_needed(image: Image.Image) -> Image.Image:
    longest = max(image.width, image.height)
    if longest <= MAX_IMAGE_SIDE:
        return image
    scale = MAX_IMAGE_SIDE / longest
    new_size = (int(image.width * scale), int(image.height * scale))
    return image.resize(new_size, Image.BILINEAR)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": os.path.basename(MODEL_PATH),
        "classes": CLASS_NAMES,
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "Field 'image' (base64 data URL) wajib diisi"}), 400

    image_b64 = data["image"]
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as exc:
        return jsonify({"error": f"Gagal decode gambar: {exc}"}), 400

    image = _resize_if_needed(image)

    t0 = time.time()
    results = model.predict(
        image,
        conf=CONF_THRESHOLD,
        iou=IOU_THRESHOLD,
        verbose=False,
    )
    infer_ms = round((time.time() - t0) * 1000, 1)

    detections = []
    r = results[0]
    for box in r.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
        detections.append({
            "class_id": cls_id,
            "class_name": CLASS_NAMES.get(cls_id, str(cls_id)),
            "confidence": round(conf, 3),
            "box": [x1, y1, x2, y2],
        })

    return jsonify({
        "detections": detections,
        "image_width": image.width,
        "image_height": image.height,
        "inference_ms": infer_ms,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
