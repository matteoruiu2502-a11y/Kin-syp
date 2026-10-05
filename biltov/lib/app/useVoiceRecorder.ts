"use client";

// Enregistrement d'un message vocal (façon WhatsApp) : audio (MediaRecorder), niveau sonore pour
// l'onde animée (Web Audio) et transcription en direct (reconnaissance vocale du navigateur).
// Compatible Safari iOS : format audio/mp4, contexte audio créé pendant le geste de l'utilisateur.

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderError = "insecure" | "denied" | "no_mic" | "unavailable";
export type Recording = { blob: Blob | null; mime: string; duration: number; transcript: string };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const speechCtor = (): (new () => Recognition) | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
};

export const RECORDER_ERROR_TEXT: Record<RecorderError, string> = {
  insecure: "Le micro n'est disponible que sur une page sécurisée (https).",
  denied: "L'accès au micro est refusé. Autorisez-le dans les réglages du navigateur (sur iPhone : Réglages → Safari → Micro), puis réessayez, ou écrivez votre message.",
  no_mic: "Aucun micro n'a été détecté sur cet appareil. Écrivez votre message.",
  unavailable: "Le micro n'a pas pu démarrer. Fermez les autres applications qui l'utilisent, puis réessayez.",
};

export const MAX_SECONDS = 120;

export function useVoiceRecorder(lang = "fr-BE") {
  const [state, setState] = useState<"idle" | "requesting" | "recording">("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.08));
  const [live, setLive] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const rec = useRef<Recognition | null>(null);
  const transcript = useRef({ final: "", interim: "" });
  const audio = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<(() => Promise<Recording | null>) | null>(null);

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (audio.current) {
      cancelAnimationFrame(audio.current.raf);
      void audio.current.ctx.close().catch(() => {});
      audio.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    recorder.current = null;
    setLevels(Array(28).fill(0.08));
  }, []);

  useEffect(
    () => () => {
      rec.current?.abort();
      cleanup();
    },
    [cleanup],
  );

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setError(window.isSecureContext ? "unavailable" : "insecure"), false;
    setState("requesting");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const name = (e as DOMException).name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "no_mic" : "unavailable");
      setState("idle");
      return false;
    }
    stream.current = s;
    chunks.current = [];
    transcript.current = { final: "", interim: "" };
    setLive("");

    // Audio (pour la bulle et la réécoute)
    const mime = pickMime();
    if (mime !== null) {
      try {
        const r = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
        r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        r.start(250);
        recorder.current = r;
      } catch {
        recorder.current = null;
      }
    }

    // Onde sonore
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const tick = (t: number) => {
        if (!audio.current) return;
        audio.current.raf = requestAnimationFrame(tick);
        if (t - last < 60) return;
        last = t;
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevels((l) => [...l.slice(1), Math.min(1, 0.08 + peak * 1.8)]);
      };
      audio.current = { ctx, raf: requestAnimationFrame(tick) };
    } catch {
      audio.current = null;
    }

    // Transcription en direct
    const C = speechCtor();
    if (C) {
      try {
        const r = new C();
        r.lang = lang;
        r.interimResults = true;
        r.continuous = true;
        r.onresult = (e) => {
          let interim = "";
          for (let k = e.resultIndex; k < e.results.length; k++) {
            const res = e.results[k];
            if (res.isFinal) transcript.current.final += `${res[0].transcript} `;
            else interim += res[0].transcript;
          }
          transcript.current.interim = interim;
          setLive((transcript.current.final + interim).trim());
        };
        r.onerror = () => {};
        r.start();
        rec.current = r;
      } catch {
        rec.current = null;
      }
    }

    startedAt.current = Date.now();
    setElapsed(0);
    timer.current = setInterval(() => {
      const sec = (Date.now() - startedAt.current) / 1000;
      setElapsed(sec);
      if (sec >= MAX_SECONDS) void stopRef.current?.();
    }, 200);
    setState("recording");
    return true;
  }, [lang]);

  /** Termine l'enregistrement et renvoie l'audio et sa transcription. */
  const stop = useCallback(async (): Promise<Recording | null> => {
    if (!stream.current) return null;
    const duration = (Date.now() - startedAt.current) / 1000;
    const r = recorder.current;
    const blobDone = new Promise<Blob | null>((resolve) => {
      if (!r || r.state === "inactive") return resolve(null);
      r.onstop = () => resolve(chunks.current.length ? new Blob(chunks.current, { type: r.mimeType || "audio/mp4" }) : null);
      r.stop();
    });
    // la reconnaissance livre ses derniers mots juste après l'arrêt
    const textDone = new Promise<void>((resolve) => {
      const g = rec.current;
      if (!g) return resolve();
      const t = setTimeout(resolve, 1500);
      g.onend = () => (clearTimeout(t), resolve());
      g.stop();
    });
    const [blob] = await Promise.all([blobDone, textDone]);
    rec.current = null;
    const mime = r?.mimeType || "";
    cleanup();
    setState("idle");
    const { final, interim } = transcript.current;
    return { blob, mime, duration, transcript: `${final} ${interim}`.replace(/\s+/g, " ").trim() };
  }, [cleanup]);
  stopRef.current = stop;

  const cancel = useCallback(() => {
    recorder.current?.state !== "inactive" && recorder.current?.stop();
    rec.current?.abort();
    rec.current = null;
    cleanup();
    setState("idle");
  }, [cleanup]);

  return { state, error, setError, elapsed, levels, live, start, stop, cancel, transcriptionSupported: typeof window !== "undefined" && !!speechCtor() };
}
