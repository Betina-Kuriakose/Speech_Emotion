import glob
import io
import os
import pickle
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import librosa
import numpy as np
import soundfile as sf
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier


EMOTIONS: Dict[str, str] = {
    "01": "neutral",
    "02": "calm",
    "03": "happy",
    "04": "sad",
    "05": "angry",
    "06": "fearful",
    "07": "disgust",
    "08": "surprised",
}

OBSERVED_EMOTIONS: List[str] = ["calm", "happy", "fearful", "disgust"]
EXPECTED_FEATURE_SIZE = 180


@dataclass
class TrainResult:
    accuracy: float
    report: Dict[str, Dict[str, float]]
    train_samples: int
    test_samples: int
    feature_size: int


class SpeechEmotionModel:
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        self.model: Optional[MLPClassifier] = None

    @staticmethod
    def _extract_feature_from_signal(signal: np.ndarray, sample_rate: int) -> Optional[np.ndarray]:
        try:
            # Keep behavior close to notebook: skip very short samples.
            if len(signal) < 2048:
                return None

            if signal.ndim > 1:
                signal = np.mean(signal, axis=1)

            result = np.array([])
            stft = np.abs(librosa.stft(signal))

            mfccs = np.mean(librosa.feature.mfcc(y=signal, sr=sample_rate, n_mfcc=40), axis=1)
            result = np.hstack((result, mfccs))

            chroma_feat = np.mean(librosa.feature.chroma_stft(S=stft, sr=sample_rate), axis=1)
            result = np.hstack((result, chroma_feat))

            mel_feat = np.mean(librosa.feature.melspectrogram(y=signal, sr=sample_rate), axis=1)
            result = np.hstack((result, mel_feat))

            if len(result) != EXPECTED_FEATURE_SIZE:
                return None

            return result
        except Exception:
            return None

    @classmethod
    def extract_feature_from_file(cls, file_name: str) -> Optional[np.ndarray]:
        try:
            with sf.SoundFile(file_name) as sound_file:
                signal = sound_file.read(dtype="float32")
                sample_rate = sound_file.samplerate
            return cls._extract_feature_from_signal(signal, sample_rate)
        except Exception:
            return None

    @classmethod
    def extract_feature_from_bytes(cls, audio_bytes: bytes) -> Optional[np.ndarray]:
        try:
            signal, sample_rate = sf.read(io.BytesIO(audio_bytes), dtype="float32")
            return cls._extract_feature_from_signal(signal, sample_rate)
        except Exception:
            return None

    def load_or_none(self) -> bool:
        if not os.path.exists(self.model_path):
            return False
        with open(self.model_path, "rb") as f:
            self.model = pickle.load(f)
        return True

    def save(self) -> None:
        if self.model is None:
            raise ValueError("No model available to save.")
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(self.model, f)

    def load_data(self, dataset_glob: str, test_size: float = 0.25) -> Tuple[np.ndarray, np.ndarray, List[str], List[str]]:
        x: List[np.ndarray] = []
        y: List[str] = []

        for file_path in glob.glob(dataset_glob):
            file_name = os.path.basename(file_path)
            parts = file_name.split("-")
            if len(parts) < 3:
                continue

            emotion_code = parts[2]
            emotion = EMOTIONS.get(emotion_code)
            if emotion not in OBSERVED_EMOTIONS:
                continue

            feature = self.extract_feature_from_file(file_path)
            if feature is None:
                continue

            x.append(feature)
            y.append(emotion)

        if not x:
            raise ValueError(
                "No training samples found. Check dataset path and file naming format."
            )

        return train_test_split(np.array(x), y, test_size=test_size, random_state=9)

    def train(self, dataset_glob: str) -> TrainResult:
        x_train, x_test, y_train, y_test = self.load_data(dataset_glob=dataset_glob, test_size=0.25)

        self.model = MLPClassifier(
            alpha=0.01,
            batch_size=256,
            epsilon=1e-08,
            hidden_layer_sizes=(300,),
            learning_rate="adaptive",
            max_iter=500,
        )
        self.model.fit(x_train, y_train)
        y_pred = self.model.predict(x_test)

        accuracy = accuracy_score(y_true=y_test, y_pred=y_pred)
        report = classification_report(y_test, y_pred, output_dict=True)

        self.save()
        return TrainResult(
            accuracy=accuracy,
            report=report,
            train_samples=int(x_train.shape[0]),
            test_samples=int(x_test.shape[0]),
            feature_size=int(x_train.shape[1]),
        )

    def predict(self, audio_bytes: bytes) -> Dict[str, object]:
        if self.model is None:
            raise ValueError("Model not loaded. Train first or load a saved model.")

        feature = self.extract_feature_from_bytes(audio_bytes)
        if feature is None:
            raise ValueError("Could not extract valid features from audio.")

        feature_2d = feature.reshape(1, -1)
        predicted = self.model.predict(feature_2d)[0]

        probabilities: Dict[str, float] = {}
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(feature_2d)[0]
            for label, prob in zip(self.model.classes_, probs):
                probabilities[str(label)] = float(prob)

        confidence = max(probabilities.values()) if probabilities else None
        return {
            "emotion": predicted,
            "confidence": confidence,
            "probabilities": probabilities,
        }
