# Mindflow - Voice Journal and Emotion Insight App

Mindflow is a journaling web app where users can speak, convert voice to text, predict emotion, and receive gentle support suggestions.

It combines:
- speech emotion recognition from audio
- live voice-to-text transcription in the browser
- mood selection and guidance (`calm`, `happy`, `sad`, `anxious`)
- secure user authentication
- MongoDB persistence for users and journal entries

## Core Features

- **User accounts**: Register and log in with username/password.
- **Voice journaling**: Record voice notes directly in the app.
- **Voice-to-text**: Auto-fills journal text from speech (browser-supported).
- **Emotion prediction**: Predicts emotion from recorded/uploaded WAV audio.
- **Combined mood inference**: Uses voice emotion + content signals to choose final mood.
- **Support nudges**: Updates contextual help links based on selected/predicted mood.
- **History and trends**: Stores entries and computes emotional trend summaries.

## Tech Stack

- **Backend**: FastAPI, Python
- **ML/Audio**: librosa, soundfile, scikit-learn
- **Database**: MongoDB (Atlas or local), PyMongo
- **Frontend**: HTML, CSS, Vanilla JavaScript

## Project Structure

```text
Speech_Emotion/
├── backend/
│   ├── app.py
│   ├── ser_model.py
│   ├── requirements.txt
│   ├── .env
│   └── model/
│       └── emotion_model.pkl
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── README.md
```

## Environment Setup

Create `backend/.env` with:

```env
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=mindflow_journal
```

Example local MongoDB URI:

```env
MONGO_URI=mongodb://127.0.0.1:27017
```

## Run the App

### 1) Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 2) Start backend server

From project root:

```bash
python -m uvicorn backend.app:app --reload
```

### 3) Open in browser

Visit:

`http://127.0.0.1:8000`

### 4) Use the flow

1. Register a new account (first time) or log in.
2. Record your voice note.
3. Let voice-to-text fill your journal content.
4. Emotion is predicted from audio and aligned with mood buttons.
5. Save the entry and review trend history.

## Model Notes

- The SER model uses extracted features:
  - MFCC
  - Chroma
  - Mel spectrogram
- Classifier: `MLPClassifier`
- Saved model path:
  - `backend/model/emotion_model.pkl`

If you need to retrain, use your training notebook/pipeline and overwrite the saved model file.

## Database Collections

Mindflow currently uses these MongoDB collections:

- `users`
  - `username`
  - `password_hash`
  - `created_at`
- `entries`
  - `id`
  - `username`
  - `title`
  - `transcript`
  - `emotion`
  - `confidence`
  - `created_at`

## API Overview

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`
- `POST /predict`
- `POST /journal/entries`
- `GET /journal/entries`
- `GET /journal/trends`

## Important Notes

- Voice-to-text uses browser speech recognition APIs; support may vary by browser.
- Passwords are stored as hashed values, not plain text.
- Keep `backend/.env` private and never commit credentials.

## Future Improvements

- JWT-based protected routes
- Better NLP sentiment/content understanding
- Better trend visualizations
- Export journal entries

## Author

Betina Kuriakose
