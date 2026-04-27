const apiBaseInput = document.getElementById("apiBaseUrl");
const audioFileInput = document.getElementById("audioFile");
const startRecordBtn = document.getElementById("startRecordBtn");
const stopRecordBtn = document.getElementById("stopRecordBtn");
const predictRecordedBtn = document.getElementById("predictRecordedBtn");
const predictFileBtn = document.getElementById("predictFileBtn");
const recordingPreview = document.getElementById("recordingPreview");

const healthBtn = document.getElementById("healthBtn");

const healthOutput = document.getElementById("healthOutput");
const predictOutput = document.getElementById("predictOutput");

let mediaRecorder = null;
let recordedChunks = [];
let recordedWavBlob = null;

function apiBase() {
  return apiBaseInput.value.trim().replace(/\/$/, "");
}

function print(target, data) {
  target.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function safeFetch(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return body;
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  floatTo16BitPCM(view, 44, samples);

  return new Blob([view], { type: "audio/wav" });
}

async function convertToWav(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = decoded.getChannelData(0);
  const wavBlob = encodeWav(channelData, decoded.sampleRate);
  await audioCtx.close();
  return wavBlob;
}

async function predictWithBlob(blob, filename) {
  print(predictOutput, "Running prediction...");
  const formData = new FormData();
  formData.append("file", blob, filename);
  const data = await safeFetch(`${apiBase()}/predict`, {
    method: "POST",
    body: formData,
  });
  print(predictOutput, data);
}

healthBtn.addEventListener("click", async () => {
  print(healthOutput, "Checking backend...");
  try {
    const data = await safeFetch(`${apiBase()}/health`);
    print(healthOutput, data);
  } catch (error) {
    print(healthOutput, `Error: ${error.message}`);
  }
});

startRecordBtn.addEventListener("click", async () => {
  try {
    recordedChunks = [];
    recordedWavBlob = null;
    recordingPreview.removeAttribute("src");
    predictRecordedBtn.disabled = true;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (!recordedChunks.length) {
        print(predictOutput, "No audio captured. Please try again.");
        return;
      }
      try {
        const recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        recordedWavBlob = await convertToWav(recordedBlob);
        recordingPreview.src = URL.createObjectURL(recordedWavBlob);
        predictRecordedBtn.disabled = false;
        print(predictOutput, "Recording ready. Click 'Predict from Recording'.");
      } catch (error) {
        print(predictOutput, `Could not process recording: ${error.message}`);
      }

      stream.getTracks().forEach((track) => track.stop());
      startRecordBtn.disabled = false;
      stopRecordBtn.disabled = true;
    };

    mediaRecorder.start();
    startRecordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    print(predictOutput, "Recording... click 'Stop Recording' when done.");
  } catch (error) {
    print(predictOutput, `Microphone error: ${error.message}`);
  }
});

stopRecordBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
});

predictRecordedBtn.addEventListener("click", async () => {
  if (!recordedWavBlob) {
    print(predictOutput, "Record audio first.");
    return;
  }
  try {
    await predictWithBlob(recordedWavBlob, "recorded.wav");
  } catch (error) {
    print(predictOutput, `Error: ${error.message}`);
  }
});

predictFileBtn.addEventListener("click", async () => {
  const file = audioFileInput.files?.[0];
  if (!file) {
    print(predictOutput, "Please choose a .wav file first.");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".wav")) {
    print(predictOutput, "Please upload a WAV (.wav) file.");
    return;
  }
  try {
    await predictWithBlob(file, file.name);
  } catch (error) {
    print(predictOutput, `Error: ${error.message}`);
  }
});

window.addEventListener("load", async () => {
  // Surface model status immediately for prediction-only workflow.
  print(healthOutput, "Checking backend...");
  try {
    const data = await safeFetch(`${apiBase()}/health`);
    print(healthOutput, data);
    if (!data.model_loaded) {
      print(
        predictOutput,
        "Model is not loaded. Save your trained notebook model to backend/model/emotion_model.pkl first."
      );
    }
  } catch (error) {
    print(healthOutput, `Error: ${error.message}`);
  }
});
