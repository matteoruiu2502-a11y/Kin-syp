import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import type { JointId, MeasureMode } from '@core';
import { DEMO_IMAGE, demoFrame, drawDemo, type DemoScenario } from '../demo/demoPatient';
import { detect, getPoseLandmarker } from './detector';
import { mapToView } from './mapping';
import { MeasurePipeline, type LiveState, type Snapshot } from './pipeline';

export type SourceKind = 'demo' | 'camera' | 'video';

export interface EngineStatus {
  fps: number;
  /** Chargement du modèle, attente caméra… */
  message: string | null;
  error: string | null;
  caption: string | null;
}

interface Options {
  mode: MeasureMode;
  source: SourceKind;
  scenario: DemoScenario;
  paused: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stageRef: RefObject<HTMLElement | null>;
}

const TARGET_FRAME_MS = 1000 / 30;

/** Boucle d'analyse image par image, identique quelle que soit la source. */
export function useLiveAnalysis({ mode, source, scenario, paused, videoRef, canvasRef, stageRef }: Options) {
  const pipeline = useRef(new MeasurePipeline()).current;
  const [live, setLive] = useState<LiveState>(pipeline.state);
  const [status, setStatus] = useState<EngineStatus>({ fps: 0, message: null, error: null, caption: null });
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    pipeline.hardReset();
    let raf = 0;
    let cancelled = false;
    let lastProcess = 0;
    let demoTime = 0;
    let lastTick = performance.now();
    const fpsWindow: number[] = [];
    let landmarker: Awaited<ReturnType<typeof getPoseLandmarker>> | null = null;

    if (source !== 'demo') {
      setStatus((s) => ({ ...s, message: 'Chargement du modèle MediaPipe…', error: null, caption: null }));
      getPoseLandmarker()
        .then((l) => {
          if (cancelled) return;
          landmarker = l;
          setStatus((s) => ({ ...s, message: null }));
        })
        .catch((e) => {
          if (!cancelled) setStatus((s) => ({ ...s, message: null, error: `Impossible de charger MediaPipe dans ce navigateur (${e?.message ?? e}). Le mode Démo reste disponible.` }));
        });
    } else {
      setStatus({ fps: 0, message: null, error: null, caption: null });
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastProcess < TARGET_FRAME_MS - 2) return;
      // Temps écoulé depuis la dernière image traitée (la démo suit l'horloge réelle).
      const dt = now - lastTick;
      lastTick = now;
      lastProcess = now;
      const stage = stageRef.current;
      if (!stage) return;
      const view = { width: stage.clientWidth, height: stage.clientHeight };

      let normalized: Array<{ x: number; y: number; visibility?: number }> | null = null;
      let world;
      let image = DEMO_IMAGE;
      let caption: string | null = null;

      if (source === 'demo') {
        if (!pausedRef.current) demoTime += Math.min(dt, 100) / 1000;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) drawDemo(ctx, scenario, demoTime);
        const f = demoFrame(scenario, demoTime);
        normalized = f.landmarks;
        world = f.world;
        caption = f.caption;
      } else {
        const video = videoRef.current;
        if (!landmarker || !video || video.readyState < 2 || video.videoWidth === 0) return;
        if (video.paused && source === 'video') return;
        const result = detect(landmarker, video);
        image = { width: video.videoWidth, height: video.videoHeight };
        normalized = result?.landmarks[0] ?? [];
        world = result?.worldLandmarks[0]?.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      }

      const landmarks = normalized.length ? mapToView(normalized, image, view, source === 'camera') : [];
      const state = pipeline.process(landmarks, world, Date.now(), modeRef.current);
      fpsWindow.push(now);
      while (fpsWindow.length && now - fpsWindow[0] > 1000) fpsWindow.shift();
      setLive(state);
      setStatus((s) => (s.fps === fpsWindow.length && s.caption === caption ? s : { ...s, fps: fpsWindow.length, caption }));
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [source, scenario, pipeline, videoRef, canvasRef, stageRef]);

  const restart = useCallback(() => {
    pipeline.restart();
    setLive(pipeline.state);
  }, [pipeline]);
  const setFocus = useCallback((id: JointId | null) => pipeline.setFocus(id), [pipeline]);
  const snapshot = useCallback((): Snapshot => pipeline.snapshot(), [pipeline]);

  return { live, status, restart, setFocus, snapshot };
}
