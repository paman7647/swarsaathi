import { useCallback, useEffect, useRef, useState } from "react";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useSpeechRecognition({ locale, onUtterance }) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [permissionState, setPermissionState] = useState("idle");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const finalTextRef = useRef("");
  const callbackRef = useRef(onUtterance);

  useEffect(() => {
    callbackRef.current = onUtterance;
  }, [onUtterance]);

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    setError("");
    if (!SpeechRecognition) {
      setError("This browser does not expose live speech recognition.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionState("granted");
    } catch {
      setPermissionState("denied");
      setError("Microphone permission denied. Browser settings lo allow cheyandi.");
      return;
    }

    finalTextRef.current = "";
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = locale === "mixed" ? "hi-IN" : locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        setError(`Speech capture stopped: ${event.error}.`);
      }
    };
    recognition.onresult = (event) => {
      let finalText = finalTextRef.current;
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const phrase = event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalText = `${finalText} ${phrase}`.trim();
        } else {
          interimText += phrase;
        }
      }
      finalTextRef.current = finalText;
      setInterimTranscript(`${finalText} ${interimText}`.trim());
    };
    recognition.onend = () => {
      const utterance = finalTextRef.current.trim();
      setIsListening(false);
      setInterimTranscript("");
      if (utterance) {
        callbackRef.current(utterance);
      }
    };
    recognition.start();
  }, [locale]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  return {
    available: Boolean(SpeechRecognition),
    error,
    interimTranscript,
    isListening,
    permissionState,
    start,
    stop,
  };
}

