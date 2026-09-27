import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Delegate,
  RunningMode,
  usePoseDetection,
  type DetectionError,
  type MediaPipeSolution,
  type PoseDetectionResultBundle,
  type ViewCoordinator,
} from 'react-native-mediapipe';

import {
  CompensationDetector,
  JointAnalyzer,
  type Compensation,
  type JointAnalysis,
  type JointId,
  type PoseFrame,
  type ScreenLandmark,
} from '../../core';
// Nom du fichier embarqué par plugins/withPoseModel.js.
import { POSE_MODEL_FILE } from '../../../pose-model.config';

export interface LiveMeasureState {
  /** Repères en coordonnées écran, null si aucun patient détecté. */
  landmarks: ScreenLandmark[] | null;
  analysis: JointAnalysis;
  compensations: Compensation[];
  /** La posture de référence (anti-triche) est capturée. */
  calibrated: boolean;
  fps: number;
  inferenceMs: number;
  error: string | null;
}

export interface PoseAnalysisControls {
  solution: MediaPipeSolution;
  state: LiveMeasureState;
  /** Nouvelle série : remet à zéro les extrêmes et la posture de référence. */
  restart: () => void;
  /** Verrouille le focus sur une articulation (null = détection automatique). */
  setFocus: (id: JointId | null) => void;
}

const FPS_WINDOW_MS = 1000;

/**
 * Relie le détecteur MediaPipe (inférence native, GPU, hors thread JS) aux
 * algorithmes de mesure. Tout est calculé localement sur l'appareil.
 */
export function usePoseAnalysis(): PoseAnalysisControls {
  const analyzer = useRef(new JointAnalyzer()).current;
  const compensation = useRef(new CompensationDetector()).current;
  const fpsWindow = useRef<number[]>([]);

  const [state, setState] = useState<LiveMeasureState>(() => ({
    landmarks: null,
    analysis: analyzer.process({ timestampMs: 0, landmarks: [] }),
    compensations: [],
    calibrated: false,
    fps: 0,
    inferenceMs: 0,
    error: null,
  }));

  const onResults = useCallback(
    (bundle: PoseDetectionResultBundle, vc: ViewCoordinator) => {
      const now = Date.now();
      const window = fpsWindow.current;
      window.push(now);
      while (window.length > 0 && now - window[0] > FPS_WINDOW_MS) window.shift();

      const pose = bundle.results[0]?.landmarks[0];
      const world = bundle.results[0]?.worldLandmarks[0];

      let landmarks: ScreenLandmark[] = [];
      if (pose && pose.length > 0) {
        // Conversion image caméra → écran (rotation, miroir, recadrage "cover").
        // Transformation conforme : les angles mesurés à l'écran sont exacts.
        const frameDims = vc.getFrameDims(bundle);
        landmarks = pose.map((lm) => {
          const p = vc.convertPoint(frameDims, lm);
          return { x: p.x, y: p.y, visibility: lm.visibility ?? 1 };
        });
      }

      const frame: PoseFrame = { timestampMs: now, landmarks, worldLandmarks: world };
      const analysis = analyzer.process(frame);
      const compensations = compensation.process(frame);

      setState({
        landmarks: landmarks.length > 0 ? landmarks : null,
        analysis,
        compensations,
        calibrated: compensation.hasBaseline,
        fps: window.length,
        inferenceMs: bundle.inferenceTime,
        error: null,
      });
    },
    [analyzer, compensation],
  );

  const onError = useCallback((error: DetectionError) => {
    setState((s) => ({ ...s, error: error.message }));
  }, []);

  const callbacks = useMemo(() => ({ onResults, onError }), [onResults, onError]);

  const solution = usePoseDetection(callbacks, RunningMode.LIVE_STREAM, POSE_MODEL_FILE, {
    numPoses: 1,
    delegate: Delegate.GPU,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const restart = useCallback(() => {
    analyzer.resetPeaks();
    compensation.resetBaseline();
  }, [analyzer, compensation]);

  const setFocus = useCallback((id: JointId | null) => analyzer.setFocus(id), [analyzer]);

  return { solution, state, restart, setFocus };
}
