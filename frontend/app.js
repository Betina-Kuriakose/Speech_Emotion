// === DOM ELEMENT DECLARATIONS ===
const loginView = document.getElementById("loginView");
const journalView = document.getElementById("journalView");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginError = document.getElementById("loginError");
const welcomeText = document.getElementById("welcomeText");
const statusMessage = document.getElementById("statusMessage");
const switchUserBtn = document.getElementById("switchUserBtn");

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

// Chatbot DOM elements
const chatbotPanel = document.getElementById("chatbot-panel");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const closeChatBtn = document.getElementById("closeChatBtn");
const chatMicBtn = document.getElementById("chatMicBtn");
const chatRecordingPreview = document.getElementById("chatRecordingPreview");

// === STATE VARIABLES ===
let mediaRecorder = null;
let recordedChunks = [];
let recordedWavBlob = null;
let lastPrediction = null;
let selectedMood = null;
let currentUsername = null;
let speechRecognition = null;
let liveTranscript = "";
let lastDetectedEmotion = null;

// Chatbot microphone recording state
let chatMediaRecorder = null;
let chatRecordedChunks = [];
let chatRecordingActive = false;

// === CONFIGURATION ===
const moodConfig = {
  neutral: {
    text: "A steady day? Good time for a quick reflection.",
    linkLabel: "Quick Link: Daily gratitude prompt",
    linkHref: "https://positivepsychology.com/gratitude-journal-prompts/",
  },
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
  angry: {
    text: "Feeling a bit heated? Let's find a healthy outlet.",
    linkLabel: "Quick Link: 2-minute venting note",
    linkHref: "https://www.youtube.com/results?search_query=2+minute+guided+journaling+venting",
  },
  fearful: {
    text: "Feeling uneasy? You're in a safe space right now.",
    linkLabel: "Quick Link: 4-7-8 grounding breathing",
    linkHref: "https://www.youtube.com/results?search_query=4-7-8+breathing+technique",
  },
  disgust: {
    text: "Something rubbing you the wrong way? Let's unpack it.",
    linkLabel: "Quick Link: Trigger deep-dive prompt",
    linkHref: "https://positivepsychology.com/journaling-prompts/",
  },
  surprised: {
    text: "A sudden shift? Journal it while it's fresh!",
    linkLabel: "Quick Link: Good or bad surprise?",
    linkHref: "https://www.psychologytoday.com/us/blog/questions-and-answers/201912/the-power-reflective-questions",
  },
};

const textMoodKeywords = {
  neutral: ["normal", "steady", "average", "usual", "regular", "fine"],
  happy: ["happy", "great", "excited", "grateful", "joy", "smile", "good", "amazing", "win"],
  calm: ["calm", "peaceful", "relaxed", "stable", "okay", "balanced", "fine", "content"],
  sad: ["sad", "down", "lonely", "tired", "hopeless", "cry", "upset", "heavy", "hurt"],
  anxious: ["anxious", "stress", "worried", "panic", "nervous", "overwhelmed", "racing", "fear"],
  angry: ["angry", "mad", "furious", "annoyed", "irritated", "rage", "frustrated"],
  fearful: ["fearful", "scared", "afraid", "terrified", "uneasy"],
  disgust: ["disgust", "gross", "revolting", "nasty", "repulsed"],
  surprised: ["surprised", "shocked", "unexpected", "sudden", "wow"],
};

// === FUNCTIONS ===
// --- Chatbot microphone recording logic ---
async function startChatRecording() {
  if (chatRecordingActive) return;
  chatRecordedChunks = [];
  chatRecordingActive = true;
  chatMicBtn.classList.add("recording");
  chatRecordingPreview.removeAttribute("src");
  // Start browser speech recognition for transcript
  let recognition = null;
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + " ";
      }
      chatInput.value = transcript.trim();
    };
    recognition.onerror = () => {};
    recognition.onend = () => {};
    recognition.start();
    chatMicBtn._recognition = recognition;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chatMediaRecorder = new MediaRecorder(stream);
    chatMediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chatRecordedChunks.push(event.data);
    };
    chatMediaRecorder.onstop = () => {
      if (!chatRecordedChunks.length) return;
      const audioBlob = new Blob(chatRecordedChunks, { type: chatMediaRecorder.mimeType });
      chatRecordingPreview.src = URL.createObjectURL(audioBlob);
      stream.getTracks().forEach((track) => track.stop());
    };
    chatMediaRecorder.start();
  } catch (err) {
    alert("Microphone access denied or unavailable: " + err.message);
    chatRecordingActive = false;
    chatMicBtn.classList.remove("recording");
    if (chatMicBtn._recognition) {
      chatMicBtn._recognition.stop();
      chatMicBtn._recognition = null;
    }
  }
}

function stopChatRecording() {
  if (!chatRecordingActive) return;
  chatRecordingActive = false;
  chatMicBtn.classList.remove("recording");
  if (chatMediaRecorder && chatMediaRecorder.state === "recording") {
    chatMediaRecorder.stop();
  }
  if (chatMicBtn._recognition) {
    try { chatMicBtn._recognition.stop(); } catch {}
    chatMicBtn._recognition = null;
  }
}

function apiBase() {
  if (apiBaseInput && apiBaseInput.value) {
    return apiBaseInput.value.trim().replace(/\/$/, "");
  }
  return window.location.origin.replace(/\/$/, "");
}

function setStatus(message) {
  if (statusMessage) statusMessage.textContent = message;
}

function normalizeVoiceMood(emotion) {
  const mood = String(emotion || "").toLowerCase();
  if (moodConfig[mood]) return mood;
  if (mood === "fear") return "fearful";
  return null;
}

function inferTextMood(text) {
  const cleaned = String(text || "").toLowerCase();
  if (!cleaned.trim()) return null;

  let bestMood = null;
  let bestScore = 0;

  Object.entries(textMoodKeywords).forEach(([mood, words]) => {
    const score = words.reduce((sum, word) => sum + (cleaned.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  });

  return bestScore > 0 ? bestMood : null;
}

function chooseFinalMood(voiceEmotion, transcriptText) {
  const voiceMood = normalizeVoiceMood(voiceEmotion);
  const textMood = inferTextMood(transcriptText);
  // Give transcript slightly higher priority when content is expressive.
  return textMood || voiceMood;
}

function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = true;
  return recognition;
}

function startSpeechToText() {
  speechRecognition = createSpeechRecognition();
  if (!speechRecognition) {
    setStatus("Recording started. Live speech-to-text is not supported on this browser.");
    return;
  }

  liveTranscript = "";
  speechRecognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += `${event.results[i][0].transcript} `;
    }
    liveTranscript = transcript.trim();
    if (journalText && liveTranscript) {
      journalText.value = liveTranscript;
    }
  };

  speechRecognition.onerror = () => {
    // Non-fatal; audio emotion inference still works.
  };

  try {
    speechRecognition.start();
  } catch {
    // ignore repeated-start errors
  }
}

function stopSpeechToText() {
  if (!speechRecognition) return;
  try {
    speechRecognition.stop();
  } catch {
    // ignore stop errors
  }
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

async function predictWithBlob(blob, filename, transcriptText = "") {
  setStatus("Running emotion prediction...");
  const formData = new FormData();
  formData.append("file", blob, filename);
  const data = await safeFetch(`${apiBase()}/predict`, { method: "POST", body: formData });
  lastPrediction = data;
  const finalMood = chooseFinalMood(data.emotion, transcriptText);
  lastDetectedEmotion = finalMood || data.emotion;
  if (finalMood && moodConfig[finalMood]) {
    applyMoodSelection(finalMood);
    setStatus(`Detected mood: voice=${data.emotion}, content=${inferTextMood(transcriptText) || "none"} -> final=${finalMood}`);
  } else {
    setStatus(`Detected voice emotion: ${data.emotion}`);
  }
  // Automatically open chatbot after prediction
  if (currentUsername && lastDetectedEmotion) {
    openChatbot();
  }
}

// Chatbot Functions
function openChatbot() {
  if (chatbotPanel) {
    chatbotPanel.classList.remove("hidden");
    chatMessages.innerHTML = "";
    chatInput.value = "";
    chatInput.focus();
    // Add initial greeting from assistant
    const emotion = lastDetectedEmotion || selectedMood || "neutral";
    const greeting = getInitialGreeting(emotion);
    displayChatMessage("assistant", greeting);
  }
}

function closeChatbot() {
  if (chatbotPanel) {
    chatbotPanel.classList.add("hidden");
  }
}

function getInitialGreeting(emotion) {
  const greetings = {
    happy: "That's wonderful! I'm so glad you're feeling happy right now. What's making you feel this way?",
    calm: "It sounds like you're in a peaceful state. What are you grateful for today?",
    neutral: "How are you doing today? What's on your mind?",
    sad: "I'm here for you. Would you like to talk about what's making you feel this way?",
    anxious: "I can sense some worry. Take a breath—you're safe here. What's racing through your mind?",
    angry: "I can feel the intensity. It's okay to feel angry. What triggered this feeling?",
    fearful: "You're in a safe space. Sometimes fear can teach us something important. What are you afraid of?",
    disgust: "Something's clearly bothering you. I'm listening. What is it?",
    surprised: "What a moment! Tell me what just happened.",
  };
  return greetings[emotion] || greetings.neutral;
}

function displayChatMessage(role, content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = content;
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
  const userMessage = chatInput.value.trim();
  if (!userMessage || !currentUsername || !lastDetectedEmotion) return;

  // Display user message
  displayChatMessage("user", userMessage);
  chatInput.value = "";
  chatInput.disabled = true;
  sendChatBtn.disabled = true;

  try {
    const journalContext = journalText.value.trim().substring(0, 500) || undefined;
    const response = await safeFetch(`${apiBase()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUsername,
        message: userMessage,
        emotion: lastDetectedEmotion,
        context: journalContext,
      }),
    });

    displayChatMessage("assistant", response.response);
  } catch (error) {
    displayChatMessage("assistant", `I encountered an issue: ${error.message}. Please try again.`);
  } finally {
    chatInput.disabled = false;
    sendChatBtn.disabled = false;
    chatInput.focus();
  }
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
        <div class="entry-actions">
          <button type="button" class="entry-btn edit" data-action="edit" data-id="${entry.id}">Edit</button>
          <button type="button" class="entry-btn delete" data-action="delete" data-id="${entry.id}">Delete</button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    setStatus(`Could not load entries: ${error.message}`);
  }
}

async function handleEditEntry(entryId) {
  const title = window.prompt("Update title:");
  if (title === null) return;
  const transcript = window.prompt("Update journal text:");
  if (transcript === null || !transcript.trim()) return;
  const emotion = window.prompt(
    "Update emotion (neutral/calm/happy/sad/anxious/angry/fearful/disgust/surprised):",
    selectedMood || "neutral"
  );
  if (emotion === null || !emotion.trim()) return;

  try {
    await safeFetch(`${apiBase()}/journal/entries/${encodeURIComponent(entryId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: currentUsername,
        title: title.trim(),
        transcript: transcript.trim(),
        emotion: emotion.trim().toLowerCase(),
        confidence: null,
      }),
    });
    setStatus("Entry updated.");
    if (moodConfig[emotion.trim().toLowerCase()]) {
      applyMoodSelection(emotion.trim().toLowerCase());
    }
    await loadEntries();
  } catch (error) {
    setStatus(`Update failed: ${error.message}`);
  }
}

async function handleDeleteEntry(entryId) {
  const confirmed = window.confirm("Delete this journal entry?");
  if (!confirmed) return;
  try {
    await safeFetch(
      `${apiBase()}/journal/entries/${encodeURIComponent(entryId)}?username=${encodeURIComponent(currentUsername)}`,
      { method: "DELETE" }
    );
    setStatus("Entry deleted.");
    await loadEntries();
  } catch (error) {
    setStatus(`Delete failed: ${error.message}`);
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
  if (switchUserBtn) {
    const initial = username.trim().charAt(0).toUpperCase() || "U";
    switchUserBtn.textContent = initial;
    switchUserBtn.title = `Switch user (currently ${username})`;
  }
}

function switchUser() {
  currentUsername = null;
  sessionStorage.removeItem("mindflow_user");
  journalView.classList.add("hidden");
  loginView.classList.remove("hidden");
  loginPassword.value = "";
  loginError.textContent = "";
  entriesList.innerHTML = "";
  setStatus("Switched user. Please log in.");
  loginUsername.focus();
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
      startSpeechToText();
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        if (!recordedChunks.length) return;
        const recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        recordedWavBlob = await convertToWav(recordedBlob);
        stopSpeechToText();
        recordingPreview.src = URL.createObjectURL(recordedWavBlob);
        predictRecordedBtn.disabled = false;
        stream.getTracks().forEach((track) => track.stop());
        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordLabel.textContent = "Record Voice Note";
        await predictWithBlob(recordedWavBlob, "recorded.wav", liveTranscript || journalText.value || "");
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
      await predictWithBlob(recordedWavBlob, "recorded.wav", journalText.value || "");
    } catch (error) {
      setStatus(`Prediction error: ${error.message}`);
    }
  });

  predictFileBtn.addEventListener("click", async () => {
    const file = audioFileInput.files?.[0];
    if (!file) return;
    try {
      await predictWithBlob(file, file.name, journalText.value || "");
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
    const emotion = selectedMood || normalizeVoiceMood(lastPrediction?.emotion) || lastPrediction?.emotion;
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
  if (switchUserBtn) {
    switchUserBtn.addEventListener("click", () => switchUser());
  }

  entriesList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-action");
    const entryId = target.getAttribute("data-id");
    if (!action || !entryId) return;
    if (action === "edit") {
      await handleEditEntry(entryId);
    } else if (action === "delete") {
      await handleDeleteEntry(entryId);
    }
  });

  // Chatbot event listeners
  if (chatMicBtn) {
    chatMicBtn.addEventListener("click", () => {
      if (!chatRecordingActive) {
        startChatRecording();
      } else {
        stopChatRecording();
      }
    });
  }
  if (sendChatBtn) {
    sendChatBtn.addEventListener("click", () => sendChatMessage());
  }
  if (chatInput) {
    chatInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    });
  }
  if (closeChatBtn) {
    closeChatBtn.addEventListener("click", () => closeChatbot());
  }
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
