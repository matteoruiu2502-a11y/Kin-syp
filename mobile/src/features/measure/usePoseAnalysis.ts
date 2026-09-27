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
  GhostRecorder,
  JOINTS,
  JointAnalyzer,
  PostureSmoother,
  RepetitionTracker,
  analyzePosture,
  summarizeRepetitions,
  type Compensation,
  type GhostTrack,
  type JointAnalysis,
  type JointId,
  type MeasureMode,
  type PoseFrame,
  type PostureAnalysis,
  type Repetition,
  type ScreenLandmark,
  type SportSummary,
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
  /** Mode posturologie : analyse lissée. */
  posture: PostureAnalysis | null;
  /** Mode sport : répétitions de l'articulation active. */
  repCount: number;
  lastRep: Repetition | null;
  fps: number;
  error: string | null;
}

export interface MeasureSnapshot {
  analysis: JointAnalysis;
  sport: SportSummary[];
  posture: PostureAnalysis | null;
  ghost: GhostTrack | null;
}

export interface PoseAnalysisControls {
  solution: MediaPipeSolution;
  state: LiveMeasureState;
  /** Nouvelle série : remet à zéro extrêmes, répétitions, posture de référence. */
  restart: () => void;
  /** Verrouille le focus sur une articulation (null = détection automatique). */
  setFocus: (id: JointId | null) => void;
  /** Photographie l'état courant pour l'enregistrement de la séance. */
  snapshot: () => MeasureSnapshot;
}

const FPS_WINDOW_MS = 1000;

function makeTrackers(): Record<JointId, RepetitionTracker> {
  return Object.fromEntries(JOINTS.map((j) => [j.id, new RepetitionTracker()])) as Record<JointId, RepetitionTracker>;
}

/**
 * Relie le détecteur MediaPipe (inférence native, GPU, hors thread JS) aux
 * algorithmes de mesure. Tout est calculé localement sur l'appareil.
 */
export function usePoseAnalysis(mode: MeasureMode): PoseAnalysisControls {
  const analyzer = useRef(new JointAnalyzer()).current;
  const compensation = useRef(new CompensationDetector()).current;
  const postureSmoother = useRef(new PostureSmoother()).current;
  const ghostRecorder = useRef(new GhostRecorder()).current;
  const trackers = useRef(makeTrackers()).current;
  const fpsWindow = useRef<number[]>([]);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const lastState = useRef<LiveMeasureState | null>(null);

  const [state, setState] = useState<LiveMeasureState>(() => ({
    landmarks: null,
    analysis: analyzer.process({ timestampMs: 0, landmarks: [] }),
    compensations: [],
    calibrated: false,
    posture: null,
    repCount: 0,
    lastRep: null,
    fps: 0,
    error: null,
  }));
  lastState.current = state;

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
      const compensations = modeRef.current === 'posture' ? [] : compensation.process(frame);
      if (landmarks.length > 0) ghostRecorder.push(landmarks, now);

      // Répétitions (mode sport) : alimentées par les valeurs lissées.
      let lastRep: Repetition | null = lastState.current?.lastRep ?? null;
      for (const j of JOINTS) {
        const m = analysis.joints[j.id];
        if (m.tracked && m.value !== null && !m.outOfPlane) {
          const rep = trackers[j.id].push(m.value, now);
          if (rep && j.id === analysis.activeJointId) lastRep = rep;
        }
      }
      const active = analysis.activeJointId;

      let posture: PostureAnalysis | null = null;
      if (modeRef.current === 'posture' && landmarks.length > 0) {
        const raw = analyzePosture(landmarks);
        posture = raw ? postureSmoother.push(raw) : null;
      }

      setState({
        landmarks: landmarks.length > 0 ? landmarks : null,
        analysis,
        compensations,
        calibrated: compensation.hasBaseline,
        posture,
        repCount: active ? trackers[active].repetitions.length : 0,
        lastRep,
        fps: window.length,
        error: null,
      });
    },
    [analyzer, compensation, ghostRecorder, postureSmoother, trackers],
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
    postureSmoother.reset();
    for (const t of Object.values(trackers)) t.reset();
    setState((s) => ({ ...s, repCount: 0, lastRep: null }));
  }, [analyzer, compensation, postureSmoother, trackers]);

  const setFocus = useCallback((id: JointId | null) => analyzer.setFocus(id), [analyzer]);

  const snapshot = useCallback((): MeasureSnapshot => {
    const current = lastState.current!;
    const sport = JOINTS.map((j) => summarizeRepetitions(j.id, trackers[j.id].repetitions)).filter(
      (s): s is SportSummary => s !== null,
    );
    return {
      analysis: current.analysis,
      sport,
      posture: current.posture,
      ghost: ghostRecorder.toTrack(),
    };
  }, [ghostRecorder, trackers]);

  return { solution, state, restart, setFocus, snapshot };
}
