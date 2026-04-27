const apiBaseInput = document.getElementById("apiBaseUrl");
const datasetGlobInput = document.getElementById("datasetGlob");
const audioFileInput = document.getElementById("audioFile");

const healthBtn = document.getElementById("healthBtn");
const trainBtn = document.getElementById("trainBtn");
const predictBtn = document.getElementById("predictBtn");

const healthOutput = document.getElementById("healthOutput");
const trainOutput = document.getElementById("trainOutput");
const predictOutput = document.getElementById("predictOutput");

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

healthBtn.addEventListener("click", async () => {
  print(healthOutput, "Checking backend...");
  try {
    const data = await safeFetch(`${apiBase()}/health`);
    print(healthOutput, data);
  } catch (error) {
    print(healthOutput, `Error: ${error.message}`);
  }
});

trainBtn.addEventListener("click", async () => {
  print(trainOutput, "Training started. This can take a while...");

  const payload = {};
  if (datasetGlobInput.value.trim()) {
    payload.dataset_glob = datasetGlobInput.value.trim();
  }

  try {
    const data = await safeFetch(`${apiBase()}/train`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    print(trainOutput, data);
  } catch (error) {
    print(trainOutput, `Error: ${error.message}`);
  }
});

predictBtn.addEventListener("click", async () => {
  const file = audioFileInput.files?.[0];
  if (!file) {
    print(predictOutput, "Please choose a .wav file first.");
    return;
  }

  print(predictOutput, "Running prediction...");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const data = await safeFetch(`${apiBase()}/predict`, {
      method: "POST",
      body: formData,
    });
    print(predictOutput, data);
  } catch (error) {
    print(predictOutput, `Error: ${error.message}`);
  }
});
