# 🎙️ Speech Emotion Recognition using Machine Learning

## 📌 Project Overview

This project focuses on **Speech Emotion Recognition (SER)** using machine learning techniques. The goal is to analyze audio signals and classify the underlying human emotion based on speech.

The model extracts acoustic features such as **MFCC, Chroma, and Mel Spectrogram**, and uses a neural network classifier to predict emotions like *calm, happy, fearful, and disgust*.

---

## 🎯 Objective

* Build a system to **recognize emotions from speech**
* Apply **audio feature extraction techniques**
* Train a **machine learning model (MLPClassifier)** for classification

---

## 📥 Dataset

The dataset used is **RAVDESS (Ryerson Audio-Visual Database of Emotional Speech and Song)**.

Due to its large size (**~24.8GB**), it is **not included in this repository**.

👉 Download from Kaggle:
https://www.kaggle.com/datasets/uwrfkaggler/ravdess-emotional-speech-audio?resource=download

---

### 📌 Dataset Setup

1. Download and extract the dataset
2. Place it inside your project directory as follows:

```
Speech_Emotion_Recognition/
│
├── data/
│   └── dataset/
│       ├── Actor_01/
│       ├── Actor_02/
│       ├── ...
```

3. Update the dataset path in your code if needed:

```python
glob.glob("path_to_dataset/Actor_*/*.wav")
```

---

## 🛠️ Technologies Used

* Python
* NumPy
* Librosa
* SoundFile
* Scikit-learn
* Matplotlib
* Seaborn

---

## ⚙️ Features Extracted

* **MFCC (Mel Frequency Cepstral Coefficients)** – captures audio characteristics
* **Chroma Features** – represents pitch class
* **Mel Spectrogram** – frequency distribution

---

## 🧠 Model Used

* **MLPClassifier (Multi-Layer Perceptron)**

  * Hidden layer: 300 neurons
  * Learning rate: Adaptive
  * Max iterations: 500

---

## 🔄 Workflow

1. Load audio files
2. Extract features (MFCC, Chroma, Mel)
3. Handle corrupt/short audio files
4. Ensure consistent feature vector length
5. Split dataset into training and testing sets
6. Train the model
7. Predict emotions
8. Evaluate performance

---

## 📊 Results

* Achieved accuracy: **~70–75%** *(may vary depending on preprocessing and data split)*

---

## 🚧 Challenges Faced

* Handling **very short or corrupted audio files**
* Fixing **feature dimension mismatch errors**
* Ensuring **consistent feature vector size**
* Adapting to **librosa API changes**

---

## 💡 Key Learnings

* Importance of **data preprocessing in audio ML**
* Feature consistency is critical for ML models
* Real-world datasets contain **noise and irregularities**
* Debugging pipelines is as important as model building

---

## 🚀 Future Improvements

* Use deep learning models (CNN / LSTM)
* Improve accuracy with advanced feature engineering
* Add real-time emotion detection
* Build a web application interface

---

## 📁 Project Structure

```
Speech_Emotion_Recognition/
│
├── data/
├── notebooks/
│   └── analysis.ipynb
├── src/
│   └── feature_extraction.py
├── README.md
```

---

## ▶️ How to Run

### 1. Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Start backend API

```bash
uvicorn backend.app:app --reload
```

---

### 3. Open frontend

Open `frontend/index.html` in your browser.

Then:

1. Click **Check Health**
2. Click **Train** (first time)
3. Upload a `.wav` file and click **Predict**

---

## 👤 Author

**Betina Kuriakose**
Computer Science & Data Science Student

---

## ⭐ Acknowledgment

This project is inspired by real-world applications such as call centers and virtual assistants, where understanding human emotions improves user interaction and experience.
