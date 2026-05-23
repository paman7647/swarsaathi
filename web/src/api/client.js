import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api",
  timeout: 30000,
});

// Interceptor to automatically attach token if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("swarsaathi-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export async function sendTranscript({ transcript, sessionId, speechLocale, responseScript }) {
  const { data } = await api.post("chat", {
    transcript,
    session_id: sessionId || null,
    speech_locale: speechLocale,
    response_script: responseScript,
  });
  return data;
}

export async function deleteSession(sessionId) {
  const { data } = await api.delete(`sessions/${sessionId}`);
  return data;
}

export async function checkHealth() {
  const { data } = await api.get("health");
  return data;
}

// --- AUTH API METHODS ---
export async function signup(username, password) {
  const { data } = await api.post("auth/signup", { username, password });
  return data;
}

export async function login(username, password) {
  const { data } = await api.post("auth/login", { username, password });
  return data;
}

export async function logout() {
  const token = localStorage.getItem("swarsaathi-token");
  if (token) {
    try {
      await api.post("auth/logout");
    } catch (e) {
      console.warn("Logout request failed:", e);
    }
  }
}

export async function getMe() {
  const { data } = await api.get("auth/me");
  return data;
}

export function messageFromApiError(error) {
  if (!navigator.onLine) {
    return "Network offline hai. Connection aate hi try cheyandi.";
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  return "Bot service reach avvaledu. Backend running unda check cheyandi.";
}


