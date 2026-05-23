import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useSpeechSynthesis(locale) {
  const [voices, setVoices] = useState([]);
  const [voiceId, setVoiceId] = useState("");
  const [lastText, setLastText] = useState("");
  const [state, setState] = useState("idle");
  const [rate, setRate] = useState(0.96);
  const [pitch, setPitch] = useState(1.02);
  const utteranceRef = useRef(null);
  const supported = "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return undefined;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, [supported]);

  const preferredVoices = useMemo(() => {
    const wanted = locale === "mixed" ? ["hi-IN", "te-IN", "en-IN"] : [locale, "en-IN"];
    return voices.filter((voice) => wanted.some((lang) => voice.lang.startsWith(lang)));
  }, [locale, voices]);

  const selectedVoice = useMemo(() => {
    return (
      voices.find((voice) => voice.voiceURI === voiceId) ||
      preferredVoices[0] ||
      voices.find((voice) => voice.lang.includes("IN"))
    );
  }, [preferredVoices, voiceId, voices]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Dynamic voice selection based on script detection
      let activeVoice = selectedVoice;
      let activeLang = locale === "mixed" ? (selectedVoice?.lang || "hi-IN") : locale;
      
      const containsDevanagari = /[\u0900-\u097f]/.test(text);
      const containsTelugu = /[\u0c00-\u0c7f]/.test(text);
      
      if (containsDevanagari) {
        // Dynamically find a native Hindi voice from the system voices
        const hiVoice = voices.find((v) => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi"));
        if (hiVoice) {
          activeVoice = hiVoice;
          activeLang = "hi-IN";
        }
      } else if (containsTelugu) {
        // Dynamically find a native Telugu voice from the system voices
        const teVoice = voices.find((v) => v.lang.startsWith("te") || v.name.toLowerCase().includes("telugu"));
        if (teVoice) {
          activeVoice = teVoice;
          activeLang = "te-IN";
        }
      }
      
      utterance.lang = activeLang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      if (activeVoice) utterance.voice = activeVoice;
      
      utterance.onstart = () => setState("speaking");
      utterance.onpause = () => setState("paused");
      utterance.onresume = () => setState("speaking");
      utterance.onend = () => setState("idle");
      utterance.onerror = () => setState("idle");
      utteranceRef.current = utterance;
      setLastText(text);
      window.speechSynthesis.speak(utterance);
    },
    [locale, selectedVoice, supported, rate, pitch, voices],
  );

  const togglePause = useCallback(() => {
    if (!supported) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }, [supported]);

  const replay = useCallback(() => speak(lastText), [lastText, speak]);
  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState("idle");
  }, []);

  return {
    lastText,
    preferredVoices,
    replay,
    selectedVoice,
    setVoiceId,
    speak,
    state,
    stop,
    supported,
    togglePause,
    voices,
    rate,
    setRate,
    pitch,
    setPitch,
  };
}


