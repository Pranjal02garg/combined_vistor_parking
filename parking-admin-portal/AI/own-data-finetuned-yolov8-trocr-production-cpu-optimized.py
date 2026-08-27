import os, re, cv2, time, json, torch, requests, threading
import numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from ultralytics import YOLO

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


# ── CONFIG ────────────────────────────────────────────────────────────────
CAMERA_URL = os.getenv("CAMERA_URL", "rtsp://admin:admin@192.168.1.250:554/rtsp/streaming?channel=01&subtype=1")

PROCESS_INTERVAL_SEC = float(os.getenv("PROCESS_INTERVAL_SEC", "0.35"))
SYNC_INTERVAL_SEC    = int(os.getenv("SYNC_INTERVAL_SEC", "30"))
CLOSE_DELAY_SEC      = int(os.getenv("CLOSE_DELAY_SEC", "8"))
YOLO_IMGSZ           = int(os.getenv("YOLO_IMGSZ", "320"))

ALLOWED_PLATES_API = os.getenv("ALLOWED_PLATES_API", "https://admin-portal-sigma-oene.vercel.app/api/allowed-plates")

BARRIER_API_KEY = os.getenv("BARRIER_API_KEY", "Pilot@Parking")
UP_API   = os.getenv("BARRIER_UP_API", f"http://10.68.88.92:5000/barrier/up?key={BARRIER_API_KEY}")
DOWN_API = os.getenv("BARRIER_DOWN_API", f"http://10.68.88.92:5000/barrier/down?key={BARRIER_API_KEY}")

BASE          = os.getenv("WEIGHTS_BASE_DIR", r"C:\Users\Bhumi\Downloads")
LOCAL_ALLOWED_FILE = os.getenv("LOCAL_ALLOWED_FILE", os.path.join(BASE, "allowed_plates.json"))
WEIGHTSDIR    = os.path.join(BASE, "Parking_Weights")
TROCR_BASE    = os.path.join(WEIGHTSDIR, "trocr_plates")
TROCR_V2_CKPT = os.path.join(WEIGHTSDIR, "trocr_rl_v2", "checkpoint-18")
PLATEMODEL    = os.path.join(WEIGHTSDIR, "best_finetuned.pt")
DEVICE        = "cuda" if torch.cuda.is_available() else "cpu"
USE_HALF      = DEVICE == "cuda"

if DEVICE == "cuda":
    torch.backends.cudnn.benchmark = True

ALLOWED_PLATES = set()
ALLOWED_LOCK   = threading.Lock()

DIGIT_FIXES  = {"O": "0", "I": "1", "S": "5", "B": "8", "Z": "2", "G": "6", "T": "7"}
LETTER_FIXES = {"0": "O", "1": "I", "5": "S", "8": "B"}


# ── TEXT CLEANING ─────────────────────────────────────────────────────────
def clean(t):
    return re.sub(r"[^A-Z0-9]", "", str(t).upper().strip())


def postprocess(text):
    text = clean(text)
    if len(text) < 6:
        return text
    t = list(text)
    for i in [0, 1]:
        if i < len(t):
            t[i] = LETTER_FIXES.get(t[i], t[i])
    for i in [2, 3]:
        if i < len(t):
            t[i] = DIGIT_FIXES.get(t[i], t[i])
    return "".join(t[:10])


# ── ALLOWED PLATES ────────────────────────────────────────────────────────
def save_allowed_plates_local(plates):
    try:
        with open(LOCAL_ALLOWED_FILE, "w") as f:
            json.dump({"plates": list(plates)}, f, indent=2)
    except Exception as e:
        print(f"⚠️ Could not save local allowed plates: {e}")


def load_allowed_plates_local():
    try:
        if not os.path.exists(LOCAL_ALLOWED_FILE):
            return set()
        with open(LOCAL_ALLOWED_FILE, "r") as f:
            data = json.load(f)
        plates = data.get("plates", [])
        return {clean(p) for p in plates if clean(p)}
    except Exception as e:
        print(f"⚠️ Could not load local allowed plates: {e}")
        return set()


def fetch_allowed_plates_from_backend():
    try:
        response = requests.get(ALLOWED_PLATES_API, timeout=3)
        if response.status_code != 200:
            return None
        data = response.json()
        plates = data.get("plates", [])
        cleaned_plates = {clean(p) for p in plates if clean(p)}
        save_allowed_plates_local(cleaned_plates)
        return cleaned_plates
    except Exception as e:
        print(f"❌ Backend plate fetch failed: {e}")
        return None


def refresh_allowed_plates():
    global ALLOWED_PLATES
    backend_plates = fetch_allowed_plates_from_backend()
    new_plates = backend_plates if backend_plates is not None else load_allowed_plates_local()
    with ALLOWED_LOCK:
        ALLOWED_PLATES = new_plates
    print(f"🚗 Active allowed plates: {len(new_plates)}")


# ── BARRIER ───────────────────────────────────────────────────────────────
def call_barrier_api(url, state):
    try:
        response = requests.get(url, timeout=1.5)
        if response.status_code == 200:
            print(f"✅ {state}: {response.text}")
            return True
        print(f"⚠️ Barrier API status {response.status_code}")
    except Exception as e:
        print(f"❌ API Error ({state}): {e}")
    return False


# ── MODEL LOADING ─────────────────────────────────────────────────────────
print("📥 Initializing Models...")
processor_ev = TrOCRProcessor.from_pretrained(TROCR_BASE, local_files_only=True)
model_ev = VisionEncoderDecoderModel.from_pretrained(
    TROCR_V2_CKPT, local_files_only=True
).to(DEVICE)
model_ev.eval()
plate_det = YOLO(PLATEMODEL)
print(f"✅ Models loaded on {DEVICE}")


# ── RTSP CAMERA THREAD ────────────────────────────────────────────────────
class LatestFrameCamera:
    def __init__(self, source, width=640, height=480):
        self.cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.lock    = threading.Lock()
        self.frame   = None
        self.running = False
        self.thread  = None

    def start(self):
        if not self.cap.isOpened():
            raise RuntimeError(f"❌ Could not connect to RTSP stream:\n{CAMERA_URL}")
        self.running = True
        self.thread  = threading.Thread(target=self.update, daemon=True)
        self.thread.start()
        print("📷 RTSP stream connected")
        return self

    def update(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                time.sleep(0.005)
                continue
            with self.lock:
                self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is None:
                return None
            return self.frame.copy()

    def release(self):
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=0.5)
        self.cap.release()


# ── OCR PIPELINE ──────────────────────────────────────────────────────────
def process_frame_fast(frame):
    results = plate_det.predict(
        source=frame,
        conf=0.35,
        imgsz=YOLO_IMGSZ,
        device=0 if DEVICE == "cuda" else "cpu",
        half=USE_HALF,
        verbose=False
    )[0]

    if results.boxes is None or len(results.boxes) == 0:
        return None

    best_box = max(results.boxes, key=lambda b: float(b.conf[0]))
    x1, y1, x2, y2 = map(int, best_box.xyxy[0].tolist())

    h, w = frame.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    if crop.shape[0] < 24 or crop.shape[1] < 60:
        return None
    if crop.shape[0] < 64:
        scale = 64 / crop.shape[0]
        crop  = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    pil          = Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB))
    inputs       = processor_ev(images=pil, return_tensors="pt")
    pixel_values = inputs["pixel_values"].to(DEVICE, non_blocking=True)

    with torch.inference_mode():
        out = model_ev.generate(
            pixel_values,
            max_new_tokens=12,
            num_beams=1,
            do_sample=False
        )

    raw_text = processor_ev.batch_decode(out, skip_special_tokens=True)[0]
    plate    = postprocess(raw_text)
    return plate if plate else None


def warmup():
    dummy = np.zeros((480, 640, 3), dtype=np.uint8)
    try:
        plate_det.predict(
            source=dummy,
            conf=0.35,
            imgsz=YOLO_IMGSZ,
            device=0 if DEVICE == "cuda" else "cpu",
            half=USE_HALF,
            verbose=False
        )
    except Exception:
        pass


# ── MAIN LOOP ─────────────────────────────────────────────────────────────
def run_live_system():
    refresh_allowed_plates()
    warmup()

    camera   = LatestFrameCamera(CAMERA_URL, 640, 480).start()
    ocr_pool = ThreadPoolExecutor(max_workers=1)
    net_pool = ThreadPoolExecutor(max_workers=3)

    ocr_future            = None
    barrier_future        = None
    barrier_pending_state = None
    barrier_is_open       = False
    last_process_time     = 0.0
    last_sync_time        = 0.0
    last_authorized_time  = 0.0
    last_detected_plate   = ""

    print("🚀 Live System Active — press Q to quit")

    try:
        while True:
            frame = camera.read()
            if frame is None:
                time.sleep(0.005)
                continue

            now = time.time()

            # Sync allowed plates in background every 30s
            if (now - last_sync_time) >= SYNC_INTERVAL_SEC:
                last_sync_time = now
                net_pool.submit(refresh_allowed_plates)

            # Submit OCR job if previous one finished
            if ocr_future is None and (now - last_process_time) >= PROCESS_INTERVAL_SEC:
                last_process_time = now
                ocr_future = ocr_pool.submit(process_frame_fast, frame.copy())

            # Collect OCR result
            if ocr_future is not None and ocr_future.done():
                try:
                    detected_plate = ocr_future.result()
                except Exception as e:
                    print(f"❌ OCR error: {e}")
                    detected_plate = None
                ocr_future = None

                if detected_plate:
                    last_detected_plate = detected_plate
                    print(f"🔍 [OCR] {detected_plate}")

                    with ALLOWED_LOCK:
                        authorized = detected_plate in ALLOWED_PLATES

                    if authorized:
                        last_authorized_time = now
                        print("✅ [AUTHORIZED]")
                        if not barrier_is_open and barrier_pending_state is None:
                            barrier_pending_state = "OPEN"
                            barrier_future = net_pool.submit(call_barrier_api, UP_API, "OPEN")
                    else:
                        print("🚫 [DENIED]")

            # Resolve barrier API response
            if barrier_future is not None and barrier_future.done():
                try:
                    ok = barrier_future.result()
                except Exception:
                    ok = False
                if ok:
                    barrier_is_open = (barrier_pending_state == "OPEN")
                barrier_future        = None
                barrier_pending_state = None

            # Auto-close barrier after CLOSE_DELAY_SEC of no authorized plate
            if barrier_is_open and barrier_pending_state is None:
                if (now - last_authorized_time) > CLOSE_DELAY_SEC:
                    barrier_pending_state = "CLOSE"
                    barrier_future = net_pool.submit(call_barrier_api, DOWN_API, "CLOSE")

            # ── Display ──────────────────────────────────────────────────
            status_text = "BARRIER: OPEN" if barrier_is_open else "BARRIER: CLOSED"
            color       = (0, 255, 0)     if barrier_is_open else (0, 0, 255)

            cv2.putText(frame, status_text, (20, 45),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.1, color, 2)

            if last_detected_plate:
                cv2.putText(frame, f"PLATE: {last_detected_plate}", (20, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 2)

            cv2.imshow("Live Parking Monitor", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

    finally:
        if barrier_is_open:
            call_barrier_api(DOWN_API, "CLOSE")
        camera.release()
        cv2.destroyAllWindows()
        ocr_pool.shutdown(wait=False)
        net_pool.shutdown(wait=False)
        print("🛑 System stopped cleanly.")


if __name__ == "__main__":
    run_live_system()