# Mindflow: AI Voice Journal with Emotion Support

Mindflow is a full-stack journaling application that lets users speak their thoughts, convert voice to text, predict emotions, and receive contextual wellbeing nudges.

It combines speech emotion recognition, content-aware mood routing, and MongoDB-backed journaling history in a polished neon desktop UI.

---

## Features

- **Authentication**
  - Register and log in with username/password
  - Secure password hashing (PBKDF2 + salt)
  - Switch user directly from the profile avatar button

- **Voice Journaling**
  - Record voice notes in-browser
  - Automatic voice-to-text transcription (browser-supported)
  - Upload WAV files for prediction

- **Emotion Intelligence**
  - Voice-based emotion prediction via trained SER model
  - Content keyword analysis from transcript
  - Final mood auto-selection across:
    - `neutral`, `calm`, `happy`, `sad`, `anxious`, `angry`, `fearful`, `disgust`, `surprised`

- **Guided Support UX**
  - Dynamic “Gentle Nudge” card updates by mood
  - Quick links to reflection and grounding resources

- **Journal History**
  - Save entries with title, transcript, emotion, confidence, timestamp
  - View previous entries
  - **Edit** and **Delete** previous entries

- **Trend Insights**
  - Emotion counts over time
  - Positive marker tracking (`happy`, `calm`)
  - Prompting logic for prolonged low-positive patterns

---

## Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: FastAPI (Python)
- **ML/Audio**: librosa, soundfile, scikit-learn
- **Database**: MongoDB + PyMongo

---

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
│   ├── styles.css
│   ├── app.js
│  
└── README.md
```

---

## MongoDB Setup

Create `backend/.env`:

```env
MONGO_URI=your_mongodb_connection_string
MONGO_DB_NAME=mindflow_journal
```

Example local DB:

```env
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=mindflow_journal
```

---

## Run Instructions

### 1. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Start backend

From project root:

```bash
python -m uvicorn backend.app:app --reload
```

### 3. Open app

Visit:

`http://127.0.0.1:8000`

### 4. Use the app

1. Register (first-time) or log in
2. Record a voice note (or upload WAV)
3. Let voice-to-text fill your journal content
4. Review predicted mood + nudge
5. Save entry
6. Edit/Delete history if needed
7. Use avatar button to switch user

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

Database: `mindflow_journal`

- **`users`** (login info)
  - `username`
  - `password_hash`
  - `created_at`

- **`my_journal`** (journal entries)
  - `id`
  - `username`
  - `title`
  - `transcript`
  - `emotion`
  - `confidence`
  - `created_at`
  - `updated_at` (if edited)

---

## Key API Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`
- `POST /predict`
- `GET /journal/entries`
- `POST /journal/entries`
- `PUT /journal/entries/{entry_id}`
- `DELETE /journal/entries/{entry_id}`
- `GET /journal/trends`

---

## Model Details

The speech emotion model uses:

- MFCC
- Chroma
- Mel Spectrogram

Classifier: `MLPClassifier`  
Model file: `backend/model/emotion_model.pkl`

---

## Notes

- Voice-to-text depends on browser speech recognition support.
- Keep `backend/.env` private.
- The app serves frontend directly through FastAPI static mounting.

---

## Author

Betina Kuriakose
