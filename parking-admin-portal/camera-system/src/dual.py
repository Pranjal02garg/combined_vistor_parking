"""
dual.py — Dual-Camera ANPR Parking Occupancy Tracker (v3, direction-aware)
-------------------------------------------------------------------------------
Entry and exit cameras share the SAME physical lane, so BOTH cameras see
every car that passes. All reads from both cameras are funnelled into one
aggregator and merged into a single "pass" per physical car. One decision
is made per pass.

Direction rules (in priority order):
  1. Camera-verified plate that is already inside the DB      -> EXIT
  2. Any read fuzzy-matches a plate currently inside the DB   -> EXIT
  3. DB has NO record of this car. Tiebreak on FIRST camera:
       - EXIT camera saw it first  -> a car leaving that was never tracked.
                                       Log it, DO NOT change the counter,
                                       DO NOT add to cars_inside.
       - ENTRY camera saw it first -> genuine entry attempt; allowlist
                                       (GrpId=1 or local fallback) decides.

  ENTRY is allowlist-gated. EXIT never checks the allowlist — any car may
  leave. The counter only ever increments for an allowlisted car that the
  ENTRY camera actually saw first.

A per-plate cooldown (sliding window) plus a recent-exit guard prevent one
physical pass from being counted twice.
"""

import os
import re
import json
import sqlite3
import threading
import time
import difflib
from collections import Counter
from datetime import datetime
from pathlib import Path

import requests
import urllib3
from requests.auth import HTTPDigestAuth

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).resolve().parent.parent / ".env"
    if _env_path.is_file():
        load_dotenv(_env_path)
    else:
        load_dotenv()
except ImportError:
    pass

# ======================================================================
#  SETTINGS
# ======================================================================
try:
    from src.config import (
        CAM_USER,
        CAM_PASS,
        ENTRY_CAM_IP,
        EXIT_CAM_IP,
    )
except ImportError:
    CAM_USER = os.getenv("CAM_USER", "admin")
    CAM_PASS = os.getenv("CAM_PASS", os.getenv("PASS", "Pilot@Parking"))
    ENTRY_CAM_IP = os.getenv("ENTRY_CAM_IP", "172.31.172.32")
    EXIT_CAM_IP = os.getenv("EXIT_CAM_IP", "172.31.172.31")

CAM_USERNAME = os.getenv("CAM_USER", CAM_USER)
CAM_PASSWORD = os.getenv("CAM_PASS", os.getenv("PASS", CAM_PASS))
CHECK_PATH = "/API/Event/Check"
VERIFY_TLS = False
POLL_INTERVAL = 1.0
HEARTBEAT_INTERVAL_SEC = 10

PROJECT_ROOT = Path(__file__).resolve().parent.parent

CONFIG_DB = PROJECT_ROOT / "config.db"
PARKING_DB = PROJECT_ROOT / "parking.db"

# Check for local_plates.json in scripts/ first, then fallback to root
_scripts_plates = PROJECT_ROOT / "scripts" / "local_plates.json"
_root_plates = PROJECT_ROOT / "local_plates.json"
LOCAL_PLATES_FILE = _scripts_plates if _scripts_plates.exists() else _root_plates

GRP_ALLOWED = 1
GRP_BLOCKED = 2
GRP_UNKNOWN = 3

IMAGE_KEYS = {"BgImg", "PlateImg", "bg_img", "plate_img", "SnapPicture", "snap_picture"}

# ENTRY allowlist fallback matching (against master allowlist)
ENTRY_MATCH_CUTOFF = 0.88
ENTRY_MATCH_MARGIN = 0.12

# EXIT matching (against cars currently inside)
EXIT_MATCH_CUTOFF = 0.80
EXIT_MATCH_MARGIN = 0.08

# --- Pass aggregation ---
PASS_SETTLE_SEC = 3.0        # a pass is finalized after this much quiet time
                             # (long enough for the camera's verified GrpId=1
                             #  read to arrive alongside raw OCR reads)
PASS_HARD_TIMEOUT_SEC = 8.0  # ... or force-finalized after this total age
MERGE_SIMILARITY = 0.60      # reads at least this similar merge into one pass

# --- Per-plate cooldown (replaces global lane lock + spam filter) ---
PLATE_COOLDOWN_SEC = 20      # ignore repeat passes of the SAME plate this long

MIN_DWELL_SEC = 15           # a car can't "exit" this soon after entering
REENTRY_GRACE_SEC = 45       # ... and can't "re-enter" this soon after exiting
                             # (unless camera-verified GrpId=1) — kills stragglers

# ======================================================================
#  LOCAL ALLOWLIST SYNC (used by ENTRY fallback only)
# ======================================================================
ALLOWED_PLATES = []
ALLOWED_PLATES_LOCK = threading.Lock()


def normalize_plate(text: str) -> str:
    return "".join(ch for ch in str(text).upper() if ch.isalnum())


def trailing_digits(text: str) -> str:
    m = re.search(r"(\d+)$", normalize_plate(text))
    return m.group(1) if m else ""


def load_local_plates():
    global ALLOWED_PLATES
    try:
        if LOCAL_PLATES_FILE.exists():
            with open(LOCAL_PLATES_FILE, 'r') as f:
                new_plates = json.load(f)
            new_plates = [normalize_plate(p) for p in new_plates if str(p).strip()]
            with ALLOWED_PLATES_LOCK:
                ALLOWED_PLATES = new_plates
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}][LOCAL-SYNC] Loaded {len(new_plates)} allowed plates (entry fallback list).")
    except Exception as e:
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}][LOCAL-SYNC] WARNING: Failed to read local_plates.json: {e}")


def local_file_watcher():
    last_mtime = 0
    while True:
        try:
            if LOCAL_PLATES_FILE.exists():
                mtime = os.path.getmtime(LOCAL_PLATES_FILE)
                if mtime != last_mtime:
                    load_local_plates()
                    last_mtime = mtime
        except Exception:
            pass
        time.sleep(3)


def _candidate_structure_ok(raw_plate: str, candidate: str) -> bool:
    raw_n = normalize_plate(raw_plate)
    cand_n = normalize_plate(candidate)
    if not raw_n or not cand_n:
        return False
    if abs(len(raw_n) - len(cand_n)) > 1:
        return False
    raw_tail = trailing_digits(raw_n)
    cand_tail = trailing_digits(cand_n)
    if raw_tail and cand_tail:
        if not (raw_tail == cand_tail or raw_tail.startswith(cand_tail) or cand_tail.startswith(raw_tail)):
            return False
    raw_head = raw_n[:4]
    cand_head = cand_n[:4]
    if raw_head and cand_head:
        if difflib.SequenceMatcher(None, raw_head, cand_head).ratio() < 0.75:
            return False
    return True


# ======================================================================
#  INDIAN PLATE STRUCTURE + OCR CONFUSION HANDLING
#  Standard format: LL DD L{1,2} DDDD  (state, district, series, number)
#  The 4-digit number is unique per vehicle -> strong anchor for matching.
#  Temporary/other formats fall back to fuzzy matching.
# ======================================================================

# Characters OCR routinely confuses — folded to one representative each.
_CONFUSION_CLASSES = ["0ODQ", "1IL", "2Z", "4A", "5S", "6GE", "8B", "7TY", "FP", "VW"]
_FOLD = {}
for _cls in _CONFUSION_CLASSES:
    for _ch in _cls:
        _FOLD[_ch] = _cls[0]


def fold_plate(text: str) -> str:
    """Collapse OCR-confusable characters so e.g. PB658E4926 == PB65BE4926."""
    return "".join(_FOLD.get(ch, ch) for ch in normalize_plate(text))


# letter -> digit when a DIGIT is expected at that position
_L2D = {"O": "0", "D": "0", "Q": "0", "I": "1", "L": "1", "Z": "2",
        "A": "4", "S": "5", "G": "6", "E": "6", "T": "7", "Y": "7", "B": "8"}
# digit -> possible letters when a LETTER is expected at that position
_D2L = {"0": ["O", "D", "Q"], "1": ["I", "L"], "2": ["Z"], "4": ["A"],
        "5": ["S"], "6": ["G", "E"], "7": ["T", "Y"], "8": ["B"]}

PLATE_RE = re.compile(r"^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$")


def structural_candidates(raw: str) -> list:
    """Coerce a raw read into the standard LL DD L{1,2} DDDD shape by fixing
    type-mismatched characters (digit where a letter belongs and vice versa).
    Returns all plausible corrected plates (may be several when a digit maps
    to multiple letters). Empty list if the read can't fit the format."""
    raw_n = normalize_plate(raw)
    if not (8 <= len(raw_n) <= 11):
        return []
    state, district = raw_n[:2], raw_n[2:4]
    number, series = raw_n[-4:], raw_n[4:-4]
    if not (1 <= len(series) <= 2):
        return []

    def as_digits(seg):
        out = ""
        for ch in seg:
            if ch.isdigit():
                out += ch
            elif ch in _L2D:
                out += _L2D[ch]
            else:
                return None
        return out

    def as_letters_options(seg):
        opts = [""]
        for ch in seg:
            if ch.isalpha():
                choices = [ch]
            elif ch in _D2L:
                choices = _D2L[ch]
            else:
                return None
            opts = [p + c for p in opts for c in choices]
            if len(opts) > 30:
                return None
        return opts

    district_f = as_digits(district)
    number_f = as_digits(number)
    state_opts = as_letters_options(state)
    series_opts = as_letters_options(series)
    if district_f is None or number_f is None or not state_opts or not series_opts:
        return []

    out = []
    for st in state_opts:
        for se in series_opts:
            cand = f"{st}{district_f}{se}{number_f}"
            if PLATE_RE.match(cand):
                out.append(cand)
    return out


def sliding_match(raw: str, candidates: list) -> dict:
    """For reads where characters were DROPPED or corrupted
    (e.g. FH11DJ921 for PB11DJ6921).

    Anchors on the plate format LL DD L(1-2) DDDD:
      - district code (chars 3-4) must agree after digit-coercion
      - the last >=3 digits of the read must be a suffix of the candidate's
        unique 4-digit number
    then requires the folded read to align onto the folded candidate with
    at most 2 missing characters and 1 substitution.
    Accepts ONLY a unique winner — ambiguity means no match."""
    raw_n = normalize_plate(raw)
    if len(raw_n) < 7 or not candidates:
        return {"matched": False, "plate": raw_n, "score": 0.0, "how": None}
    raw_f = fold_plate(raw_n)

    raw_district = "".join(_L2D.get(ch, ch) for ch in raw_n[2:4])
    raw_tail = trailing_digits(raw_n)

    hits = []
    for cand in candidates:
        if abs(len(cand) - len(raw_n)) > 2:
            continue
        if raw_district.isdigit() and cand[2:4].isdigit() and raw_district != cand[2:4]:
            continue
        cand_tail = trailing_digits(cand)
        if len(raw_tail) < 3:
            continue  # not enough number anchor — too risky
        if cand_tail:
            # The 4-digit number is the strong anchor. Allow at most ONE
            # differing/missing digit between the read's number and the
            # candidate's (covers a single dropped or misread digit), and
            # require the digit MULTISET to nearly agree so a reordered or
            # unrelated number (252 vs 5252) is rejected.
            dl = 1.0 - difflib.SequenceMatcher(None, raw_tail, cand_tail).ratio()
            approx_edits = dl * max(len(raw_tail), len(cand_tail))
            if approx_edits > 1.2:
                continue
        cand_f = fold_plate(cand)
        sm = difflib.SequenceMatcher(None, raw_f, cand_f)
        matched = sum(b.size for b in sm.get_matching_blocks())
        missing = len(cand_f) - matched   # chars of the real plate the read lost
        wrong = len(raw_f) - matched      # chars of the read that fit nowhere
        if missing <= 2 and wrong <= 1:
            hits.append((matched / len(cand_f), cand))

    winners = {c for _, c in hits}
    if len(winners) == 1:
        score, plate = max(hits)
        return {"matched": True, "plate": plate, "score": round(min(score, 0.95), 2), "how": "sliding"}
    return {"matched": False, "plate": raw_n, "score": 0.0, "how": None}


def match_against(raw: str, candidates: list, cutoff: float, margin: float) -> dict:
    """Tiered matcher used for both the allowlist (entry) and the inside-DB
    (exit). Tiers, strongest first:
      1. exact            — raw is literally in candidates
      2. fold-exact       — identical after OCR-confusion folding (unique)
      3. structural       — fixing letter/digit type mismatches yields a candidate
      4. sliding          — dropped/corrupted chars, anchored on district code
                            and the unique 4-digit number (unique winner only)
      5. folded fuzzy     — SequenceMatcher on folded strings; margin is waived
                            when the best score is very high (>= 0.94)
    """
    raw_n = normalize_plate(raw)
    if not raw_n or not candidates:
        return {"matched": False, "plate": raw_n, "score": 0.0, "how": None}

    if raw_n in candidates:
        return {"matched": True, "plate": raw_n, "score": 1.0, "how": "exact"}

    raw_f = fold_plate(raw_n)
    fold_hits = [c for c in candidates if fold_plate(c) == raw_f]
    if len(set(fold_hits)) == 1:
        return {"matched": True, "plate": fold_hits[0], "score": 0.98, "how": "ocr-fold"}

    for fixed in structural_candidates(raw_n):
        if fixed in candidates:
            return {"matched": True, "plate": fixed, "score": 0.97, "how": "structural"}
        fixed_f = fold_plate(fixed)
        s_hits = [c for c in candidates if fold_plate(c) == fixed_f]
        if len(set(s_hits)) == 1:
            return {"matched": True, "plate": s_hits[0], "score": 0.96, "how": "structural+fold"}

    sl = sliding_match(raw_n, candidates)
    if sl["matched"]:
        return sl

    scored = []
    for cand in candidates:
        if not _candidate_structure_ok(raw_n, cand):
            continue
        scored.append((difflib.SequenceMatcher(None, raw_f, fold_plate(cand)).ratio(), cand))
    scored.sort(key=lambda x: x[0], reverse=True)
    if not scored:
        return {"matched": False, "plate": raw_n, "score": 0.0, "how": None}

    best_score, best_plate = scored[0]
    runner_up = scored[1][0] if len(scored) > 1 else 0.0
    if best_score >= cutoff and ((best_score - runner_up) >= margin or best_score >= 0.94):
        return {"matched": True, "plate": best_plate, "score": best_score, "how": "fuzzy"}
    return {"matched": False, "plate": raw_n, "score": best_score, "how": None}


def entry_fallback_match(raw_plate: str) -> dict:
    """Match a raw read against the master allowlist (ENTRY decisions only)."""
    raw_n = normalize_plate(raw_plate)
    with ALLOWED_PLATES_LOCK:
        current_allowed = list(ALLOWED_PLATES)

    if not current_allowed or not raw_n:
        return {"raw": raw_n or str(raw_plate), "corrected": raw_n or str(raw_plate),
                "grp": GRP_UNKNOWN, "score": 0.0, "how": None}

    m = match_against(raw_n, current_allowed, ENTRY_MATCH_CUTOFF, ENTRY_MATCH_MARGIN)
    if m["matched"]:
        return {"raw": raw_n, "corrected": m["plate"], "grp": GRP_ALLOWED,
                "score": m["score"], "how": m["how"]}
    return {"raw": raw_n, "corrected": raw_n, "grp": GRP_UNKNOWN,
            "score": m["score"], "how": None}


def _similar(a: str, b: str) -> bool:
    a_n, b_n = normalize_plate(a), normalize_plate(b)
    if not a_n or not b_n:
        return False
    if a_n == b_n:
        return True
    return difflib.SequenceMatcher(None, a_n, b_n).ratio() >= MERGE_SIMILARITY


# ======================================================================
#  Config store
# ======================================================================
class ConfigStore:
    def __init__(self, path: Path):
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._conn.execute("CREATE TABLE IF NOT EXISTS cameras (role TEXT PRIMARY KEY, ip TEXT NOT NULL)")
        self._conn.commit()

    def get_ip(self, role: str):
        row = self._conn.execute("SELECT ip FROM cameras WHERE role = ?", (role,)).fetchone()
        return row[0] if row else None


# ======================================================================
#  Persistent occupancy store (SQLite)
# ======================================================================
class ParkingStore:
    def __init__(self, path: Path):
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS cars_inside (snap_id TEXT PRIMARY KEY, grp_id INTEGER, entered TEXT)"
        )
        self._conn.commit()

    def add_car(self, plate: str, grp_id: int) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "INSERT OR IGNORE INTO cars_inside (snap_id, grp_id, entered) VALUES (?, ?, ?)",
                (plate, grp_id, datetime.now().isoformat(timespec="seconds")),
            )
            self._conn.commit()
            return cur.rowcount == 1

    def exists(self, plate: str) -> bool:
        with self._lock:
            row = self._conn.execute(
                "SELECT 1 FROM cars_inside WHERE snap_id = ?", (plate,)).fetchone()
        return row is not None

    def seconds_since_entered(self, plate: str):
        with self._lock:
            row = self._conn.execute(
                "SELECT entered FROM cars_inside WHERE snap_id = ?", (plate,)).fetchone()
        if not row:
            return None
        return (datetime.now() - datetime.fromisoformat(row[0])).total_seconds()

    def all_inside_plates(self) -> list:
        with self._lock:
            rows = self._conn.execute("SELECT snap_id FROM cars_inside").fetchall()
        return [r[0] for r in rows]

    def best_inside_match(self, raw_plate: str) -> dict:
        """Tiered match of a raw read against plates CURRENTLY inside."""
        inside = self.all_inside_plates()
        return match_against(raw_plate, inside, EXIT_MATCH_CUTOFF, EXIT_MATCH_MARGIN)

    def remove_car(self, plate: str) -> bool:
        with self._lock:
            cur = self._conn.execute("DELETE FROM cars_inside WHERE snap_id = ?", (plate,))
            self._conn.commit()
            return cur.rowcount > 0

    def count(self) -> int:
        with self._lock:
            (n,) = self._conn.execute("SELECT COUNT(*) FROM cars_inside").fetchone()
            return n


# ======================================================================
#  PER-PLATE COOLDOWN (replaces global lane lock + spam filter)
# ======================================================================
_COOLDOWN = []           # [{"plate": ..., "ts": ..., "outcome": "entry"|"exit"|"denied"|"untracked-exit"}]
_RECENT_EXITS = []       # [{"plate": ..., "ts": ...}] — guards against straggler re-entry
_COOLDOWN_LOCK = threading.Lock()


def cooldown_hit(plates) -> dict:
    """Return the cooldown record matching any of these plates (fuzzy/fold),
    or None. Each hit REFRESHES the record's timestamp — a sliding window —
    so straggler reads of a long pass keep extending the cooldown instead of
    slipping past it and double-counting the car. The record also remembers
    the last decision, so a wrong 'denied' verdict can be overridden."""
    now = time.time()
    with _COOLDOWN_LOCK:
        _COOLDOWN[:] = [c for c in _COOLDOWN if now - c["ts"] < PLATE_COOLDOWN_SEC]
        for p in plates:
            p_n = normalize_plate(p)
            for c in _COOLDOWN:
                if _similar(c["plate"], p_n) or fold_plate(c["plate"]) == fold_plate(p_n):
                    c["ts"] = now
                    return c
    return None


def register_cooldown(plate: str, outcome: str):
    with _COOLDOWN_LOCK:
        _COOLDOWN.append({"plate": normalize_plate(plate), "ts": time.time(), "outcome": outcome})


# ======================================================================
#  UNIFIED PASS AGGREGATOR
#  All reads from BOTH cameras merge here. One physical pass -> one event.
#  Each pass remembers which camera saw the car FIRST — used as the
#  direction tiebreaker when the DB has no record of the car.
# ======================================================================
_PASSES = []             # [{"samples": [...], "first_ts": t, "last_ts": t, "first_cam": "ENTRY"|"EXIT"}]
_PASSES_LOCK = threading.Lock()


def _pass_representative(p: dict) -> str:
    """Most common raw read in the pass; ties broken by length (longer = more info)."""
    counts = Counter(s["raw"] for s in p["samples"])
    return max(counts, key=lambda k: (counts[k], len(k)))


def submit_read(cam: str, snap_id: str, raw_plate: str, cam_grp):
    raw_n = normalize_plate(raw_plate)
    if not raw_n:
        return
    sample = {"cam": cam, "raw": raw_n, "grp": cam_grp, "ts": time.time()}
    with _PASSES_LOCK:
        for p in _PASSES:
            if _similar(_pass_representative(p), raw_n):
                p["samples"].append(sample)
                p["last_ts"] = sample["ts"]
                return
        # New pass — record which camera saw this car first.
        _PASSES.append({"samples": [sample], "first_ts": sample["ts"],
                        "last_ts": sample["ts"], "first_cam": cam})


def pass_flusher():
    """Finalize passes once they've been quiet for PASS_SETTLE_SEC
    (or force after PASS_HARD_TIMEOUT_SEC)."""
    while True:
        ready = []
        now = time.time()
        with _PASSES_LOCK:
            keep = []
            for p in _PASSES:
                quiet = now - p["last_ts"] >= PASS_SETTLE_SEC
                too_old = now - p["first_ts"] >= PASS_HARD_TIMEOUT_SEC
                (ready if (quiet or too_old) else keep).append(p)
            _PASSES[:] = keep
        for p in ready:
            try:
                finalize_pass(p)
            except Exception as e:
                print(f"[GATE]  ⚠️ error finalizing pass: {e}")
        time.sleep(0.2)


# ======================================================================
#  DECISION LOGIC — one decision per physical pass
# ======================================================================
STORE: ParkingStore


def _log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}][GATE]  {msg}")


def finalize_pass(p: dict):
    samples = p["samples"]
    n = len(samples)
    first_cam = p.get("first_cam", "ENTRY")
    cams_note = "+".join(sorted({s["cam"] for s in samples}))
    raw_counts = Counter(s["raw"] for s in samples)
    raws = [r for r, _ in raw_counts.most_common()]

    # ---- 1. GrpId=1 from the ENTRY cam is ground truth (camera matched its
    #         own allowlist). GrpId=3/None means the camera couldn't identify
    #         the plate -> fall through to fold/structural/sliding search.
    verified_counts = Counter(
        s["raw"] for s in samples if s["cam"] == "ENTRY" and s["grp"] == GRP_ALLOWED
    )
    verified_plate = (max(verified_counts, key=lambda k: (verified_counts[k], len(k)))
                      if verified_counts else None)

    # ---- 2. Best match against cars currently INSIDE (across all reads)
    inside_best = {"matched": False, "plate": None, "score": 0.0, "raw": None, "how": None}
    for r in raws:
        m = STORE.best_inside_match(r)
        if m["matched"] and m["score"] > inside_best["score"]:
            inside_best = {**m, "raw": r}

    # ---- 3. Best allowlist match (across all reads)
    allow_best = None
    for r in raws:
        ev = entry_fallback_match(r)
        key = (1 if ev["grp"] == GRP_ALLOWED else 0, ev["score"])
        if allow_best is None or key > (1 if allow_best["grp"] == GRP_ALLOWED else 0, allow_best["score"]):
            allow_best = ev

    strong = bool(
        verified_plate
        or inside_best["matched"]
        or (allow_best and allow_best["grp"] == GRP_ALLOWED
            and allow_best["how"] in ("exact", "ocr-fold", "structural", "structural+fold"))
    )

    probe = verified_plate or (inside_best["plate"] if inside_best["matched"] else raws[0])

    # ---- Cooldown, outcome-aware --------------------------------------
    # A camera-verified (GrpId=1) read, or a match against a car already in
    # the DB, is strong enough to override an earlier NON-counting guess
    # (a "denied" or "unverified" verdict). This rescues the case where a
    # bad early OCR read was logged and the camera's real verdict arrives
    # a few seconds later.
    rec = cooldown_hit([probe] + raws[:3])
    if rec is not None:
        overridable = rec["outcome"] in ("denied", "unverified")
        strong_now = bool(verified_plate or inside_best["matched"])
        if overridable and strong_now:
            _log(f"🔁 {probe}: earlier read was not counted, camera-verified read arrived — re-deciding")
        else:
            _log(f"🗑️ Ignored {probe} ({n} reads, cams={cams_note}) — same car handled moments ago")
            return

    # ======================================================================
    #  DIRECTION DECISION
    # ======================================================================

    # (A) Car is IN the DB -> it is EXITING. (Camera-verified match first,
    #     then any fuzzy match against the inside list.)
    if verified_plate and STORE.exists(verified_plate):
        do_exit(verified_plate, verified_plate, n, cams_note, "exact")
        return

    if inside_best["matched"]:
        do_exit(inside_best["plate"], inside_best["raw"], n, cams_note, inside_best["how"])
        return

    # (B) Car is NOT in the DB. Direction now depends on which camera saw
    #     it FIRST in this pass.
    #
    #     EXIT-first  -> a car that is LEAVING but was never tracked (system
    #                    was down when it entered, or its entry was missed).
    #                    Log it, but DO NOT increment the counter and DO NOT
    #                    add it to cars_inside. This is the bug fix.
    if first_cam == "EXIT":
        register_cooldown(probe, "untracked-exit")
        _log(f"➡️ {probe} left (untracked — EXIT saw it first, never in lot) "
             f"({n} reads, cams={cams_note}) | inside now: {STORE.count()}")
        return

    #     ENTRY-first -> genuine entry attempt.
    #
    #     COUNTER RULE: only a camera-verified read (GrpId=1) may increment
    #     occupancy. The camera has confirmed the plate against its own
    #     onboard allowlist, so we trust it. Local fuzzy/sliding/fold
    #     matches are guesses — as the CH01CT2521 case showed, they can
    #     latch onto the wrong plate — so they never add a car.
    if verified_plate:
        do_entry(verified_plate, verified_plate, "camera-verified", n, cams_note)
        return

    # Not verified by the camera. Do NOT count it. Just log what we saw.
    register_cooldown(raws[0], "unverified")
    if allow_best and allow_best["grp"] == GRP_ALLOWED:
        _log(f"➡️ {raws[0]} seen (would match {allow_best['corrected']} locally, "
             f"but camera did not verify — not counted) ({n} reads, cams={cams_note})")
    else:
        _log(f"❌ {raws[0]} not allowed (best of {n} reads, cams={cams_note}) — not tracked")


def do_exit(plate: str, raw: str, n: int, cams_note: str, how: str):
    dwell = STORE.seconds_since_entered(plate)
    if dwell is not None and dwell < MIN_DWELL_SEC:
        _log(f"⚠️ Ignored {plate} — entered only {dwell:.0f}s ago (tail of same pass)")
        register_cooldown(plate, "exit")
        return
    removed = STORE.remove_car(plate)
    register_cooldown(plate, "exit")
    if removed:
        with _COOLDOWN_LOCK:
            _RECENT_EXITS.append({"plate": plate, "ts": time.time()})
        note = "" if plate == raw else f" ({how}-matched from raw read {raw})"
        _log(f"✅ -car {plate} EXIT{note} ({n} reads, cams={cams_note}) | inside now: {STORE.count()}")
    else:
        _log(f"➡️ {plate} passed — already not inside, no count change")


def do_entry(plate: str, raw: str, source: str, n: int, cams_note: str):
    # Straggler guard: a car that just EXITED can't silently "re-enter" off a
    # late duplicate read. Only the camera's own GrpId=1 verdict (ground
    # truth) is trusted for a genuine quick re-entry.
    if source != "camera-verified":
        now = time.time()
        with _COOLDOWN_LOCK:
            _RECENT_EXITS[:] = [r for r in _RECENT_EXITS if now - r["ts"] < REENTRY_GRACE_SEC]
            recent = any(_similar(r["plate"], plate) or fold_plate(r["plate"]) == fold_plate(plate)
                         for r in _RECENT_EXITS)
        if recent:
            register_cooldown(plate, "exit")
            _log(f"🗑️ Ignored {plate} — exited moments ago, treating as straggler read")
            return
    newly = STORE.add_car(plate, GRP_ALLOWED)
    register_cooldown(plate, "entry")
    if newly:
        if source == "camera-verified":
            tag = "(camera-verified, GrpId=1)"
        else:
            tag = f"({source}, corrected from {raw})" if plate != raw else f"({source})"
        _log(f"✅ +car {plate} ENTRY {tag} ({n} reads, cams={cams_note}) | inside now: {STORE.count()}")
    else:
        _log(f"➡️ {plate} already marked inside — no count change")


# ======================================================================
#  Camera poller (feeds the shared aggregator)
# ======================================================================
class CameraPoller:
    def __init__(self, name: str, base_url: str):
        self.name = name
        self.base_url = base_url
        self.session = requests.Session()
        self.csrf = None
        self._reader_id = None
        self._sequence = None
        self.recent_snaps = []

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}][{self.name}] {msg}")

    @staticmethod
    def _is_session_dead(exc: requests.HTTPError) -> bool:
        resp = exc.response
        if resp is None:
            return False
        if resp.status_code in (401, 403):
            return True
        try:
            return resp.json().get("error_code") == "expired"
        except Exception:
            return False

    def login(self) -> str:
        self._reader_id = None
        self._sequence = None
        resp = self.session.post(
            f"{self.base_url}/API/Web/Login",
            auth=HTTPDigestAuth(CAM_USERNAME, CAM_PASSWORD),
            headers={"Content-Type": "application/json"},
            json={"data": {"remote_terminal_info": "WEB,chrome"}},
            timeout=5, verify=VERIFY_TLS,
        )
        resp.raise_for_status()
        self.csrf = resp.headers.get("X-Csrftoken") or resp.headers.get("Csrftoken")
        return self.csrf

    def relogin(self):
        while True:
            try:
                self.login()
                self._log("re-login successful")
                return
            except (requests.RequestException, RuntimeError) as e:
                self._log(f"re-login failed, retrying in 5 s: {e}")
                time.sleep(5)

    def heartbeat(self):
        ts = datetime.now().strftime("%Y-%m-%d@%H:%M:%S")
        resp = self.session.post(
            f"{self.base_url}/API/Login/Heartbeat?{ts}",
            headers={"Content-Type": "application/json; charset=UTF-8", "X-Csrftoken": self.csrf},
            json={"version": "1.0", "data": {}, "actionType": "create"},
            timeout=5, verify=VERIFY_TLS,
        )
        resp.raise_for_status()

    def fetch_once(self) -> dict:
        ts = datetime.now().strftime("%Y-%m-%d@%H:%M:%S")
        url = f"{self.base_url}{CHECK_PATH}?{ts}"

        subscribe_type = [{"event": ["all"]}]
        if self._reader_id is not None:
            subscribe_type.append({"aipushpic": ["all"]})

        data = {"plus_eventchk": "eventAiPushPic", "ext_data": {"subscribe_type": subscribe_type}}
        if self._reader_id is not None:
            data.update({"reader_id": self._reader_id, "sequence": self._sequence, "lap_number": None})

        resp = self.session.post(
            url,
            headers={"Content-Type": "application/json",
                     "Accept": "application/json; charset=utf-8",
                     "X-Csrftoken": self.csrf},
            json={"version": "1.0", "data": data},
            timeout=10, verify=VERIFY_TLS,
        )
        resp.raise_for_status()
        result = resp.json()

        d = result.get("data", {})
        if "reader_id" in d:
            self._reader_id = d["reader_id"]
        if "sequence" in d:
            self._sequence = d["sequence"]
        return result

    @staticmethod
    def _extract_plates(data: dict):
        inner = data.get("data", {})
        plates = inner.get("ai_snap_picture", {}).get("PlateInfo", [])
        if not plates:
            plates = inner.get("EventTrafficCar", {}).get("PlateInfo", [])
        if not plates and "PlateInfo" in inner:
            plates = inner["PlateInfo"]

        for p in plates:
            snap_id = p.get("SnapId") or p.get("snap_id")
            if snap_id is None:
                continue

            plate_num = (
                p.get("PlateText") or p.get("plate_text") or p.get("Text")
                or p.get("PlateNumber") or p.get("plate") or p.get("Id") or snap_id
            )

            cam_grp_raw = p.get("GrpId") or p.get("grp_id") or p.get("GroupId")
            try:
                cam_grp = int(cam_grp_raw) if cam_grp_raw is not None else None
            except (TypeError, ValueError):
                cam_grp = None

            if not plate_num:
                plate_num = "UnknownPlate"
                safe_fields = {k: v for k, v in p.items() if k not in IMAGE_KEYS}
                print(f"[DEBUG] No plate text found, fields present: {json.dumps(safe_fields)}")

            yield str(snap_id), str(plate_num), cam_grp

    def run(self):
        self._log("logging in...")
        self.relogin()
        self._log("polling started")

        last_heartbeat = time.monotonic()
        while True:
            if time.monotonic() - last_heartbeat >= HEARTBEAT_INTERVAL_SEC:
                try:
                    self.heartbeat()
                    last_heartbeat = time.monotonic()
                except requests.HTTPError as e:
                    if self._is_session_dead(e):
                        self._log("session expired (heartbeat), re-login...")
                        self.relogin()
                        last_heartbeat = time.monotonic()
                except requests.RequestException:
                    pass

            try:
                data = self.fetch_once()
                for snap_id, raw_plate_num, cam_grp in self._extract_plates(data):
                    if snap_id in self.recent_snaps:
                        continue
                    self.recent_snaps.append(snap_id)
                    if len(self.recent_snaps) > 100:
                        self.recent_snaps.pop(0)
                    submit_read(self.name, snap_id, raw_plate_num, cam_grp)

            except requests.HTTPError as e:
                if self._is_session_dead(e):
                    self._log("session expired, re-login...")
                    self.relogin()
                    last_heartbeat = time.monotonic()
            except requests.RequestException:
                pass

            time.sleep(POLL_INTERVAL)


# ======================================================================
#  main
# ======================================================================
def main():
    global STORE

    print("=====================================================")
    if not LOCAL_PLATES_FILE.exists():
        print("[!] WARNING: local_plates.json not found (entry fallback correction disabled)!")
    else:
        print("[+] Found local_plates.json (used for ENTRY decisions only)")
    print("=====================================================\n")

    threading.Thread(target=local_file_watcher, name="file-watcher", daemon=True).start()
    threading.Thread(target=pass_flusher, name="pass-flusher", daemon=True).start()
    load_local_plates()

    cfg = ConfigStore(CONFIG_DB)
    entry_ip = os.getenv("ENTRY_CAM_IP", ENTRY_CAM_IP)
    exit_ip = os.getenv("EXIT_CAM_IP", EXIT_CAM_IP)

    entry_url = f"https://{entry_ip}"
    exit_url = f"https://{exit_ip}"

    STORE = ParkingStore(PARKING_DB)

    print(f"Parking DB : {PARKING_DB.resolve()}")
    print(f"Entry cam  : {entry_url}")
    print(f"Exit cam   : {exit_url}")
    print(f"Cars inside (restored from disk): {STORE.count()}\n")

    entry_poller = CameraPoller("ENTRY", entry_url)
    exit_poller = CameraPoller("EXIT", exit_url)

    threading.Thread(target=entry_poller.run, name="entry-poller", daemon=True).start()
    threading.Thread(target=exit_poller.run, name="exit-poller", daemon=True).start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()