import os
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .ser_model import SpeechEmotionModel


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
MODEL_PATH = str(BASE_DIR / "model" / "emotion_model.pkl")
DEFAULT_DATASET_GLOB = str(BASE_DIR.parent / "data" / "dataset" / "Actor_*" / "*.wav")

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


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": ser_model.model is not None,
        "model_path": MODEL_PATH,
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


# Serve frontend so the app works directly at http://127.0.0.1:8000/
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
