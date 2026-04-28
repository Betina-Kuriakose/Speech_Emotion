import json
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .ser_model import SpeechEmotionModel


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
MODEL_PATH = str(BASE_DIR / "model" / "emotion_model.pkl")
DEFAULT_DATASET_GLOB = str(BASE_DIR.parent / "data" / "dataset" / "Actor_*" / "*.wav")
JOURNAL_DATA_PATH = BASE_DIR / "data" / "journal_entries.json"
POSITIVE_EMOTIONS = {"happy", "calm"}

ser_model = SpeechEmotionModel(model_path=MODEL_PATH)
ser_model.load_or_none()

app = FastAPI(title="Speech Emotion Recognition API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TrainRequest(BaseModel):
    dataset_glob: str | None = None


class JournalEntryCreate(BaseModel):
    transcript: str = Field(..., min_length=1, max_length=1000)
    emotion: str = Field(..., min_length=1, max_length=40)
    confidence: Optional[float] = None
    created_at: Optional[str] = None


def _ensure_journal_store() -> None:
    JOURNAL_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not JOURNAL_DATA_PATH.exists():
        JOURNAL_DATA_PATH.write_text("[]", encoding="utf-8")


def _read_entries() -> List[Dict[str, Any]]:
    _ensure_journal_store()
    raw = JOURNAL_DATA_PATH.read_text(encoding="utf-8")
    entries: List[Dict[str, Any]] = json.loads(raw)
    entries.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    return entries


def _write_entries(entries: List[Dict[str, Any]]) -> None:
    _ensure_journal_store()
    JOURNAL_DATA_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")


def _parse_iso_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": ser_model.model is not None,
        "model_path": MODEL_PATH,
        "journal_data_path": str(JOURNAL_DATA_PATH),
    }


@app.post("/train")
def train(req: TrainRequest) -> Dict[str, Any]:
    dataset_glob = req.dataset_glob or os.getenv("SER_DATASET_GLOB", DEFAULT_DATASET_GLOB)

    try:
        result = ser_model.train(dataset_glob=dataset_glob)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "message": "Model trained successfully.",
        "dataset_glob": dataset_glob,
        "accuracy": result.accuracy,
        "train_samples": result.train_samples,
        "test_samples": result.test_samples,
        "feature_size": result.feature_size,
        "report": result.report,
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file.")

    if ser_model.model is None:
        raise HTTPException(
            status_code=400,
            detail="Model not loaded. Call /train first or place a saved model in backend/model.",
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file.")

    try:
        result = ser_model.predict(audio_bytes=audio_bytes)
        return {
            "filename": file.filename,
            **result,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@app.get("/journal/entries")
def list_journal_entries(limit: int = 50) -> Dict[str, Any]:
    entries = _read_entries()
    safe_limit = max(1, min(limit, 200))
    return {
        "count": len(entries),
        "items": entries[:safe_limit],
    }


@app.post("/journal/entries")
def create_journal_entry(payload: JournalEntryCreate) -> Dict[str, Any]:
    try:
        created_at = _parse_iso_datetime(payload.created_at) if payload.created_at else datetime.now(timezone.utc)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid created_at value. Use ISO format.") from exc

    entries = _read_entries()
    new_entry = {
        "id": f"entry-{int(created_at.timestamp() * 1000)}-{len(entries) + 1}",
        "transcript": payload.transcript.strip(),
        "emotion": payload.emotion.strip().lower(),
        "confidence": payload.confidence,
        "created_at": created_at.isoformat(),
    }
    entries.append(new_entry)
    entries.sort(key=lambda item: item.get("created_at", ""), reverse=True)
    _write_entries(entries)
    return {"message": "Journal entry saved.", "entry": new_entry}


@app.get("/journal/trends")
def journal_trends(weeks: int = 4) -> Dict[str, Any]:
    safe_weeks = max(1, min(weeks, 12))
    entries = _read_entries()
    now = datetime.now(timezone.utc)
    since = now - timedelta(weeks=safe_weeks)
    scoped: List[Dict[str, Any]] = []
    for entry in entries:
        try:
            created = _parse_iso_datetime(entry["created_at"])
        except Exception:
            continue
        if created >= since:
            copied = dict(entry)
            copied["_created_dt"] = created
            scoped.append(copied)

    emotion_counts: Dict[str, int] = {}
    for entry in scoped:
        emotion = str(entry.get("emotion", "unknown")).lower()
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

    positive_count = sum(emotion_counts.get(e, 0) for e in POSITIVE_EMOTIONS)
    total = len(scoped)
    positive_ratio = (positive_count / total) if total else 0.0

    latest_positive: Optional[datetime] = None
    for entry in entries:
        emotion = str(entry.get("emotion", "")).lower()
        if emotion not in POSITIVE_EMOTIONS:
            continue
        try:
            latest_positive = _parse_iso_datetime(entry["created_at"])
            break
        except Exception:
            continue

    days_since_positive = (now - latest_positive).days if latest_positive else None
    prolonged_absence = days_since_positive is None or days_since_positive >= 14

    prompts: List[str] = []
    if prolonged_absence and total >= 5:
        prompts.append(
            "You have had limited calm/happy markers recently. Consider a short grounding exercise or reaching out to someone you trust."
        )
    if positive_ratio < 0.2 and total >= 8:
        prompts.append(
            "Try adding one small mood-supporting habit this week (walk, hydration break, 5-minute breath reset)."
        )
    if prolonged_absence and total >= 10:
        prompts.append(
            "If this emotional pattern continues, consider speaking with a mental health professional in your area."
        )

    weekly_buckets: Dict[str, Dict[str, Any]] = {}
    for entry in scoped:
        created = entry["_created_dt"]
        week_label = created.strftime("%Y-W%W")
        if week_label not in weekly_buckets:
            weekly_buckets[week_label] = {"week": week_label, "total": 0, "positive": 0}
        weekly_buckets[week_label]["total"] += 1
        if str(entry.get("emotion", "")).lower() in POSITIVE_EMOTIONS:
            weekly_buckets[week_label]["positive"] += 1

    weekly = sorted(weekly_buckets.values(), key=lambda item: item["week"])

    return {
        "window_weeks": safe_weeks,
        "total_entries": total,
        "emotion_counts": emotion_counts,
        "positive_ratio": round(positive_ratio, 3),
        "days_since_positive": days_since_positive,
        "prolonged_positive_absence": prolonged_absence,
        "wellbeing_prompts": prompts,
        "weekly": weekly,
    }


# Serve frontend so the app works directly at http://127.0.0.1:8000/
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
