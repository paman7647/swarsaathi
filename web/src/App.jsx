import { AnimatePresence } from "framer-motion";
import { Headphones, Languages, SendHorizontal, ShieldAlert, RotateCcw, Download, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { messageFromApiError, sendTranscript, deleteSession, checkHealth, getMe, logout } from "./api/client";
import AuthScreen from "./components/AuthScreen";
import ChatBubble from "./components/ChatBubble";
import MicButton from "./components/MicButton";
import ThemeToggle from "./components/ThemeToggle";
import TypingIndicator from "./components/TypingIndicator";
import VoiceControls from "./components/VoiceControls";
import Waveform from "./components/Waveform";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

const GREETINGS = {
  mixed: "Namaste ji. Hindi ya Telugu mix lo boliye, aapko kaise help chahiye?",
  "hi-IN": "नमस्ते जी। आप हिंदी में बोल सकते हैं, आपको क्या सहायता चाहिए?",
  "te-IN": "నమస్తే అండి. మీరు తెలుగులో మాట్లాడవచ్చు, మీకు ఏమి సహాయం కావాలి?",
  "en-IN": "Hello! You can speak in English. How can I help you today?",
};

function shortTime(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function initialTheme() {
  const saved = localStorage.getItem("swarsaathi-theme");
  return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Subtle browser-synthesized audio effects
function playAudioBeep(freq, type = "sine", duration = 0.08) {
  try {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gainNode.gain.setValueAtTime(0.04, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    console.warn("Audio Context beep was blocked by autoplay guidelines", error);
  }
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("swarsaathi-token") || "");
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([{ id: "hello", role: "assistant", text: GREETINGS.mixed, time: "now" }]);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState(localStorage.getItem("swarsaathi-session") || "");
  const [speechLocale, setSpeechLocale] = useState("mixed");
  const [memory, setMemory] = useState({ turns: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dark, setDark] = useState(initialTheme);
  const [backendStatus, setBackendStatus] = useState("checking"); // 'online', 'offline', 'checking'
  const [responseScript, setResponseScript] = useState(localStorage.getItem("swarsaathi-script") || "roman");
  const endRef = useRef(null);
  const tts = useSpeechSynthesis(speechLocale);

  // Authenticate user profile when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let active = true;
    async function fetchMe() {
      try {
        const u = await getMe();
        if (active) setUser(u);
      } catch (err) {
        console.error("Failed to fetch user profiles, clearing invalid token:", err);
        if (active) {
          localStorage.removeItem("swarsaathi-token");
          setToken("");
          setUser(null);
        }
      }
    }
    fetchMe();
    return () => {
      active = false;
    };
  }, [token]);

  const handleAuthSuccess = (newToken, newUsername) => {
    setToken(newToken);
    setUser({ username: newUsername });
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      try {
        await logout();
      } catch (e) {
        console.warn("Logout endpoint failed:", e);
      }
      localStorage.removeItem("swarsaathi-token");
      localStorage.removeItem("swarsaathi-session");
      setToken("");
      setUser(null);
      setSessionId("");
      setMessages([{ id: "hello", role: "assistant", text: GREETINGS[speechLocale] || GREETINGS.mixed, time: "now" }]);
      setMemory({ turns: 0 });
      setDraft("");
      tts.stop();
      playAudioBeep(330, "triangle", 0.15);
    }
  };

  // Monitor server health connectivity
  useEffect(() => {
    let active = true;
    async function monitorHealth() {
      try {
        await checkHealth();
        if (active) setBackendStatus("online");
      } catch {
        if (active) setBackendStatus("offline");
      }
    }
    monitorHealth();
    const timer = setInterval(monitorHealth, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("swarsaathi-script", responseScript);
  }, [responseScript]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("swarsaathi-theme", dark ? "dark" : "light");
  }, [dark]);

  // Update the initial greeting message dynamically if the conversation has not started yet
  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0].id === "hello") {
        const text = GREETINGS[speechLocale] || GREETINGS.mixed;
        return [{ ...current[0], text }];
      }
      return current;
    });
  }, [speechLocale]);

  // Auto-switch to optimized script and voice modes when speech language changes
  useEffect(() => {
    if (speechLocale === "en-IN") {
      setResponseScript("roman");
    } else if (speechLocale === "hi-IN" || speechLocale === "te-IN") {
      setResponseScript("native");
    }
    // Reset manual voice to Auto so browser picks the best speaker for the language
    tts.setVoiceId("");
  }, [speechLocale]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, messages]);

  const submit = useCallback(
    async (rawText) => {
      const transcript = rawText.trim();
      if (!transcript || busy) return;
      setError("");
      setDraft("");
      setBusy(true);
      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: transcript,
        time: shortTime(),
      };
      setMessages((current) => [...current, userMessage]);
      try {
        const data = await sendTranscript({ transcript, sessionId, speechLocale, responseScript });
        setSessionId(data.session_id);
        localStorage.setItem("swarsaathi-session", data.session_id);
        setMemory(data.memory);
        const botMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply,
          time: shortTime(new Date(data.created_at)),
        };
        setMessages((current) => [...current, botMessage]);
        tts.speak(data.reply);
      } catch (apiError) {
        setError(messageFromApiError(apiError));
        if (apiError?.response?.status === 403) {
          localStorage.removeItem("swarsaathi-session");
          setSessionId("");
          setError("Session invalid or owned by another user. Starting a new session...");
        } else if (apiError?.response?.status === 401) {
          localStorage.removeItem("swarsaathi-token");
          setToken("");
          setUser(null);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, sessionId, speechLocale, tts, responseScript],
  );


  const handleReset = async () => {
    if (window.confirm("Are you sure you want to clear session history?")) {
      setError("");
      if (sessionId) {
        try {
          await deleteSession(sessionId);
        } catch (apiError) {
          console.warn("Session delete endpoint failed, clearing frontend memory only:", apiError);
        }
      }
      localStorage.removeItem("swarsaathi-session");
      setSessionId("");
      setMessages([{ id: "hello", role: "assistant", text: GREETINGS[speechLocale] || GREETINGS.mixed, time: "now" }]);
      setMemory({ turns: 0 });
      setDraft("");
      tts.stop();
      playAudioBeep(330, "triangle", 0.15);
    }
  };

  const handleExport = () => {
    const content = messages
      .map((m) => `[${m.time}] ${m.role.toUpperCase()}: ${m.text}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `swarsaathi-chat-${sessionId || "new"}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const speech = useSpeechRecognition({ locale: speechLocale, onUtterance: submit });
  const displayedTranscript = speech.interimTranscript || draft || "Listening transcript appears here";

  // Trigger synthesized audio effects on start / stop speech capture
  const handleMicToggle = () => {
    if (speech.isListening) {
      playAudioBeep(660, "sine", 0.07);
      speech.stop();
    } else {
      playAudioBeep(880, "sine", 0.07);
      speech.start();
    }
  };

  if (!token || !user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <main className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#ecfeff_40%,_#fff7ed)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.15),_transparent_30%),linear-gradient(135deg,_#020617,_#111827_54%,_#052e2b)] dark:text-slate-50">
      <div className="mx-auto grid h-full max-w-7xl grid-rows-[auto_1fr] px-3 py-3 sm:px-5 sm:py-5">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-950 text-emerald-300 shadow-panel dark:bg-emerald-300 dark:text-slate-950">
              <Headphones size={24} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-[0] sm:text-2xl flex items-center gap-2">
                SwarSaathi
                <span
                  title={`Backend is ${backendStatus}`}
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    backendStatus === "online"
                      ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                      : backendStatus === "offline"
                      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                      : "bg-amber-400"
                  }`}
                />
              </h1>
              <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                {speechLocale === "hi-IN"
                  ? "Hindi Voice Bot"
                  : speechLocale === "te-IN"
                  ? "Telugu Voice Bot"
                  : speechLocale === "en-IN"
                  ? "English Voice Bot"
                  : "Hindi + Telugu + English Voice Bot"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* User Profile Pill */}
            <div className="hidden md:flex items-center gap-2 rounded-md border border-white/30 bg-white/40 px-3 py-1.5 text-sm font-medium backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-emerald-300 dark:bg-emerald-300 dark:text-slate-900">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="max-w-24 truncate text-slate-700 dark:text-slate-200">
                {user.username}
              </span>
            </div>

            <label className="relative hidden sm:block">
              <span className="sr-only">Speech language</span>
              <Languages className="pointer-events-none absolute left-3 top-2.5 text-slate-500" size={18} />
              <select
                aria-label="Speech language"
                value={speechLocale}
                onChange={(event) => setSpeechLocale(event.target.value)}
                className="h-10 rounded-md border border-white/70 bg-white/75 pl-10 pr-3 text-sm outline-none backdrop-blur focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900/80"
              >
                <option value="mixed">Mixed</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
                <option value="en-IN">English</option>
              </select>
            </label>

            <ThemeToggle dark={dark} onToggle={() => setDark((value) => !value)} />

            {/* Logout Action Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="grid h-10 w-10 place-items-center rounded-md border border-rose-200/50 bg-rose-50/50 text-rose-700 backdrop-blur transition hover:bg-rose-100 dark:border-rose-950/50 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="grid min-h-0 grid-rows-[1fr_auto] overflow-hidden rounded-lg border border-white/70 bg-white/72 shadow-panel backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/72">
            <div className="min-h-0 space-y-4 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
              </AnimatePresence>
              {busy && <TypingIndicator />}
              <div ref={endRef} />
            </div>

            <form
              className="border-t border-slate-200 bg-white/85 p-3 dark:border-slate-800 dark:bg-slate-950/85 sm:p-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit(draft);
              }}
            >
              <div className="flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Message</span>
                  <textarea
                    value={draft}
                    rows={1}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit(draft);
                      }
                    }}
                    placeholder="Boliyega ya type cheyandi..."
                    className="max-h-28 min-h-12 w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition placeholder:text-slate-400 focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={!draft.trim() || busy}
                  title="Send"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-slate-950 text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-300 dark:text-slate-950"
                >
                  <SendHorizontal size={20} />
                </button>
              </div>
            </form>
          </div>

          <aside className="grid min-h-0 content-start gap-3 overflow-y-auto rounded-lg border border-white/70 bg-white/70 p-3 shadow-panel backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/70 sm:p-4">
            <div className="flex items-center justify-between sm:hidden">
              <label className="relative block flex-1">
                <span className="sr-only">Speech language</span>
                <select
                  aria-label="Mobile speech language"
                  value={speechLocale}
                  onChange={(event) => setSpeechLocale(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="mixed">Mixed speech</option>
                  <option value="hi-IN">Hindi</option>
                  <option value="te-IN">Telugu</option>
                  <option value="en-IN">English</option>
                </select>

              </label>
            </div>
            <div className="grid place-items-center rounded-md bg-teal-50 px-3 py-5 ring-1 ring-teal-100 dark:bg-teal-950/40 dark:ring-teal-900">
              <MicButton
                disabled={busy}
                isListening={speech.isListening}
                onClick={handleMicToggle}
              />
              <Waveform active={speech.isListening} />
              <p className="mb-2 text-xs font-medium uppercase text-teal-800 dark:text-teal-100">
                Live transcript
              </p>
              <p className="min-h-12 w-full break-words rounded-md bg-white/85 px-3 py-2 text-center text-sm leading-5 text-slate-700 ring-1 ring-teal-100 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700">
                {displayedTranscript}
              </p>
            </div>
            <VoiceControls
              {...tts}
              responseScript={responseScript}
              setResponseScript={setResponseScript}
            />

            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-xs text-slate-500">Customer</p>
                <p className="mt-1 truncate font-medium">{memory.user_name || "Guest"}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/80">
                <p className="text-xs text-slate-500">Turns</p>
                <p className="mt-1 font-medium">{memory.turns || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
              >
                <RotateCcw size={14} />
                Clear Chat
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 transition dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <Download size={14} />
                Save Log
              </button>
            </div>

            {(speech.error || error || !speech.available) && (
              <div role="alert" className="flex gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900">
                <ShieldAlert className="mt-0.5 shrink-0" size={16} />
                <span>
                  {speech.error ||
                    error ||
                    "Live speech recognition is unavailable here. Type a message to continue."}
                </span>
              </div>
            )}
            <p className="break-all text-xs text-slate-500 dark:text-slate-400">
              Session {sessionId || "starts on first turn"} · Mic {speech.permissionState}
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
}

