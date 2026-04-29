import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError
from pydantic import BaseModel, Field

from .ser_model import SpeechEmotionModel


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
MODEL_PATH = str(BASE_DIR / "model" / "emotion_model.pkl")
DEFAULT_DATASET_GLOB = str(BASE_DIR.parent / "data" / "dataset" / "Actor_*" / "*.wav")
load_dotenv(BASE_DIR / ".env")
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
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


mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
mongo_db = mongo_client[MONGO_DB_NAME]
users_collection: Collection = mongo_db["users"]
entries_collection: Collection = mongo_db["entries"]

try:
    users_collection.create_index([("username", ASCENDING)], unique=True)
    entries_collection.create_index([("username", ASCENDING), ("created_at", DESCENDING)])
except Exception:
    # Keep app booting even if MongoDB is currently unavailable.
    pass


class TrainRequest(BaseModel):
    dataset_glob: str | None = None


class UserAuthRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6, max_length=120)


class JournalEntryCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    title: Optional[str] = Field(default=None, max_length=160)
    transcript: str = Field(..., min_length=1, max_length=1000)
    emotion: str = Field(..., min_length=1, max_length=40)
    confidence: Optional[float] = None
    created_at: Optional[str] = None


def _check_mongo() -> bool:
    try:
        mongo_client.admin.command("ping")
        return True
    except Exception:
        return False


def _hash_password(password: str, salt_hex: Optional[str] = None) -> str:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 390000)
    return f"{salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, stored_hash = stored.split("$", maxsplit=1)
        recomputed = _hash_password(password, salt_hex=salt_hex).split("$", maxsplit=1)[1]
        return hmac.compare_digest(stored_hash, recomputed)
    except Exception:
        return False


def _parse_iso_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@app.post("/auth/register")
def register(payload: UserAuthRequest) -> Dict[str, Any]:
    if not _check_mongo():
        raise HTTPException(status_code=500, detail="MongoDB is not reachable.")

    username = payload.username.strip().lower()
    password_hash = _hash_password(payload.password)
    doc = {
        "username": username,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        users_collection.insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Username already exists.") from exc

    return {"message": "User registered successfully.", "username": username}


@app.post("/auth/login")
def login(payload: UserAuthRequest) -> Dict[str, Any]:
    if not _check_mongo():
        raise HTTPException(status_code=500, detail="MongoDB is not reachable.")

    username = payload.username.strip().lower()
    user = users_collection.find_one({"username": username})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {"message": "Login successful.", "username": username}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": ser_model.model is not None,
        "model_path": MODEL_PATH,
        "mongodb_connected": _check_mongo(),
        "mongodb_db": MONGO_DB_NAME,
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
def list_journal_entries(username: str, limit: int = 50) -> Dict[str, Any]:
    if not _check_mongo():
        raise HTTPException(status_code=500, detail="MongoDB is not reachable.")

    normalized_username = username.strip().lower()
    safe_limit = max(1, min(limit, 200))
    docs = list(
        entries_collection.find({"username": normalized_username}, {"_id": 0}).sort("created_at", DESCENDING).limit(safe_limit)
    )
    return {
        "count": len(docs),
        "items": docs,
    }


@app.post("/journal/entries")
def create_journal_entry(payload: JournalEntryCreate) -> Dict[str, Any]:
    if not _check_mongo():
        raise HTTPException(status_code=500, detail="MongoDB is not reachable.")

    normalized_username = payload.username.strip().lower()
    user_exists = users_collection.find_one({"username": normalized_username}, {"_id": 1})
    if not user_exists:
        raise HTTPException(status_code=404, detail="User not found. Please register first.")

    try:
        created_at = _parse_iso_datetime(payload.created_at) if payload.created_at else datetime.now(timezone.utc)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid created_at value. Use ISO format.") from exc

    new_entry = {
        "id": f"entry-{int(created_at.timestamp() * 1000)}-{secrets.token_hex(3)}",
        "username": normalized_username,
        "title": payload.title.strip() if payload.title else None,
        "transcript": payload.transcript.strip(),
        "emotion": payload.emotion.strip().lower(),
        "confidence": payload.confidence,
        "created_at": created_at.isoformat(),
    }
    entries_collection.insert_one(new_entry)
    return {"message": "Journal entry saved.", "entry": new_entry}


@app.get("/journal/trends")
def journal_trends(username: str, weeks: int = 4) -> Dict[str, Any]:
    if not _check_mongo():
        raise HTTPException(status_code=500, detail="MongoDB is not reachable.")

    normalized_username = username.strip().lower()
    safe_weeks = max(1, min(weeks, 12))
    entries = list(entries_collection.find({"username": normalized_username}, {"_id": 0}).sort("created_at", DESCENDING))
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
