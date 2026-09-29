"use client";

// Dictée vocale (Web Speech API : Chrome, Edge, Safari). Renvoie le texte au fil de l'eau.

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type Ctor = new () => Recognition;

const getCtor = (): Ctor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function useDictation(lang = "fr-FR") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => setSupported(!!getCtor()), []);
  useEffect(() => () => rec.current?.stop(), []);

  const start = useCallback(() => {
    const C = getCtor();
    if (!C) return setError("unsupported");
    rec.current?.stop();
    const r = new C();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let k = e.resultIndex; k < e.results.length; k++) {
        const res = e.results[k];
        if (res.isFinal) finalText += `${res[0].transcript} `;
        else interim += res[0].transcript;
      }
      setTranscript((finalText + interim).trim());
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setError(e.error);
      setListening(false);
    };
    rec.current = r;
    setTranscript("");
    setError(null);
    setListening(true);
    r.start();
  }, [lang]);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, setTranscript, error, start, stop };
}
