const loginView = document.getElementById("loginView");
const journalView = document.getElementById("journalView");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginError = document.getElementById("loginError");
const welcomeText = document.getElementById("welcomeText");
const statusMessage = document.getElementById("statusMessage");

const apiBaseInput = document.getElementById("apiBaseUrl");
const audioFileInput = document.getElementById("audioFile");
const startRecordBtn = document.getElementById("startRecordBtn");
const stopRecordBtn = document.getElementById("stopRecordBtn");
const predictRecordedBtn = document.getElementById("predictRecordedBtn");
const predictFileBtn = document.getElementById("predictFileBtn");
const recordingPreview = document.getElementById("recordingPreview");
const healthBtn = document.getElementById("healthBtn");
const journalText = document.getElementById("journalText");
const saveEntryBtn = document.getElementById("saveEntryBtn");
const refreshTrendsBtn = document.getElementById("refreshTrendsBtn");
const refreshEntriesBtn = document.getElementById("refreshEntriesBtn");
const entriesList = document.getElementById("entriesList");
const recordVoiceBtn = document.getElementById("recordVoiceBtn");
const recordLabel = document.getElementById("recordLabel");
const entryDate = document.getElementById("entryDate");
const nudgeText = document.getElementById("nudgeText");
const quickLink = document.getElementById("quickLink");
const entryTitle = document.getElementById("entryTitle");

let mediaRecorder = null;
let recordedChunks = [];
let recordedWavBlob = null;
let lastPrediction = null;
let selectedMood = null;
let currentUsername = null;

const moodConfig = {
  sad: {
    text: "Feeling a bit heavy?",
    linkLabel: "Quick Link: 5-min Breathing",
    linkHref: "https://www.youtube.com/results?search_query=5+minute+guided+breathing+exercise",
  },
  anxious: {
    text: "Mind racing? Let's ground yourself.",
    linkLabel: "Quick Link: 5-4-3-2-1 Grounding",
    linkHref: "https://www.youtube.com/results?search_query=5-4-3-2-1+grounding+technique",
  },
  calm: {
    text: "Glad you're finding peace today. Ready to reflect?",
    linkLabel: "Quick Link: Gratitude Prompt",
    linkHref: "https://www.verywellmind.com/what-is-gratitude-5207792",
  },
  happy: {
    text: "Great to hear! Keep the positive momentum going.",
    linkLabel: "Quick Link: Wins of the Week",
    linkHref: "https://jamesclear.com/three-questions",
  },
};

function apiBase() {
  if (apiBaseInput && apiBaseInput.value) {
    return apiBaseInput.value.trim().replace(/\/$/, "");
  }
  return window.location.origin.replace(/\/$/, "");
}

function setStatus(message) {
  if (statusMessage) statusMessage.textContent = message;
}

async function safeFetch(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`);
  return body;
}

function formatDateTime(isoDate) {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

function applyMoodSelection(mood) {
  selectedMood = mood;
  document.querySelectorAll(".mood-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.getAttribute("data-mood") === mood);
  });
  const cfg = moodConfig[mood];
  if (!cfg) return;
  nudgeText.textContent = cfg.text;
  quickLink.textContent = cfg.linkLabel;
  quickLink.href = cfg.linkHref;
}

function wireMoodClicks() {
  document.querySelectorAll(".mood-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const mood = chip.getAttribute("data-mood");
      applyMoodSelection(mood);
    });
  });
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i += 1, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) view.setUint8(offset + i, string.charCodeAt(i));
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
  setStatus("Running emotion prediction...");
  const formData = new FormData();
  formData.append("file", blob, filename);
  const data = await safeFetch(`${apiBase()}/predict`, { method: "POST", body: formData });
  lastPrediction = data;
  const predictedMood = String(data.emotion || "").toLowerCase();
  if (moodConfig[predictedMood]) applyMoodSelection(predictedMood);
  setStatus(`Detected mood: ${data.emotion}`);
}

async function loadEntries() {
  if (!currentUsername) return;
  try {
    const data = await safeFetch(
      `${apiBase()}/journal/entries?username=${encodeURIComponent(currentUsername)}&limit=10`
    );
    if (!data.items?.length) {
      entriesList.innerHTML = "<p>No journal entries yet. Save your first one.</p>";
      return;
    }
    entriesList.innerHTML = data.items.map((entry) => `
      <article class="entry-item">
        <div><strong>${entry.title || "Voice note"}</strong></div>
        <div class="entry-meta">${entry.emotion} • ${formatDateTime(entry.created_at)}</div>
        <div>${entry.transcript}</div>
      </article>
    `).join("");
  } catch (error) {
    setStatus(`Could not load entries: ${error.message}`);
  }
}

async function loadTrends() {
  if (!currentUsername) return;
  try {
    const data = await safeFetch(
      `${apiBase()}/journal/trends?username=${encodeURIComponent(currentUsername)}&weeks=4`
    );
    const firstPrompt = data.wellbeing_prompts?.[0];
    if (firstPrompt && !selectedMood) nudgeText.textContent = firstPrompt;
  } catch {
    // Keep UI stable when trends are unavailable.
  }
}

function setLoggedIn(username) {
  currentUsername = username;
  sessionStorage.setItem("mindflow_user", username);
  loginView.classList.add("hidden");
  journalView.classList.remove("hidden");
  welcomeText.textContent = `Welcome back, ${username}!`;
}

function wireLogin() {
  async function submitAuth(mode) {
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
      loginError.textContent = "Please enter both username and password.";
      return;
    }
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      await safeFetch(`${apiBase()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      loginError.textContent = "";
      setLoggedIn(username.toLowerCase());
      await Promise.all([loadEntries(), loadTrends()]);
      setStatus(mode === "register" ? "Account created and logged in." : "Logged in successfully.");
    } catch (error) {
      loginError.textContent = error.message;
    }
  }

  loginBtn.addEventListener("click", async () => submitAuth("login"));
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => submitAuth("register"));
  }
}

function wireInteractions() {
  healthBtn.addEventListener("click", async () => {
    try {
      await safeFetch(`${apiBase()}/health`);
      setStatus("Backend connected.");
    } catch (error) {
      setStatus(`Backend error: ${error.message}`);
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
        if (event.data.size > 0) recordedChunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        if (!recordedChunks.length) return;
        const recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        recordedWavBlob = await convertToWav(recordedBlob);
        recordingPreview.src = URL.createObjectURL(recordedWavBlob);
        predictRecordedBtn.disabled = false;
        stream.getTracks().forEach((track) => track.stop());
        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordLabel.textContent = "Record Voice Note";
        await predictWithBlob(recordedWavBlob, "recorded.wav");
      };
      mediaRecorder.start();
      startRecordBtn.disabled = true;
      stopRecordBtn.disabled = false;
    } catch (error) {
      setStatus(`Microphone error: ${error.message}`);
    }
  });

  stopRecordBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
  });

  predictRecordedBtn.addEventListener("click", async () => {
    if (!recordedWavBlob) return;
    try {
      await predictWithBlob(recordedWavBlob, "recorded.wav");
    } catch (error) {
      setStatus(`Prediction error: ${error.message}`);
    }
  });

  predictFileBtn.addEventListener("click", async () => {
    const file = audioFileInput.files?.[0];
    if (!file) return;
    try {
      await predictWithBlob(file, file.name);
    } catch (error) {
      setStatus(`Prediction error: ${error.message}`);
    }
  });

  saveEntryBtn.addEventListener("click", async () => {
    const transcript = journalText.value.trim();
    if (!transcript) {
      setStatus("Please write your journal text before saving.");
      return;
    }
    const emotion = lastPrediction?.emotion || selectedMood;
    if (!emotion) {
      setStatus("Select a mood or run voice prediction before saving.");
      return;
    }
    try {
      const payload = {
        username: currentUsername,
        title: entryTitle?.value.trim() || "Voice note",
        transcript,
        emotion,
        confidence: lastPrediction?.confidence ?? null,
        created_at: new Date().toISOString(),
      };
      await safeFetch(`${apiBase()}/journal/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      journalText.value = "";
      if (entryTitle) entryTitle.value = "";
      setStatus("Journal entry saved.");
      await loadEntries();
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  });

  recordVoiceBtn.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      recordLabel.textContent = "Processing...";
      stopRecordBtn.click();
      return;
    }
    recordLabel.textContent = "Recording... tap to stop";
    startRecordBtn.click();
  });

  refreshTrendsBtn.addEventListener("click", async () => loadTrends());
  refreshEntriesBtn.addEventListener("click", async () => loadEntries());
}

window.addEventListener("load", async () => {
  if (entryDate) {
    entryDate.textContent = new Date().toLocaleString(undefined, {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }
  wireLogin();
  wireMoodClicks();
  wireInteractions();
  applyMoodSelection("sad");

  const existingUser = sessionStorage.getItem("mindflow_user");
  if (existingUser) {
    setLoggedIn(existingUser);
    await Promise.all([loadEntries(), loadTrends()]);
  }
});
