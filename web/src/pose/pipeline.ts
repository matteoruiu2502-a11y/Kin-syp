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
  type PostureAnalysis,
  type Repetition,
  type ScreenLandmark,
  type SportSummary,
  type Vec3,
} from '@core';

export interface LiveState {
  landmarks: ScreenLandmark[] | null;
  analysis: JointAnalysis;
  compensations: Compensation[];
  calibrated: boolean;
  posture: PostureAnalysis | null;
  repCount: number;
  lastRep: Repetition | null;
}

export interface Snapshot {
  analysis: JointAnalysis;
  sport: SportSummary[];
  posture: PostureAnalysis | null;
  ghost: GhostTrack | null;
}

/** Même chaîne de traitement que l'application tablette (cœur partagé). */
export class MeasurePipeline {
  private analyzer = new JointAnalyzer();
  private compensation = new CompensationDetector();
  private postureSmoother = new PostureSmoother();
  private ghostRecorder = new GhostRecorder();
  private trackers = Object.fromEntries(JOINTS.map((j) => [j.id, new RepetitionTracker()])) as Record<JointId, RepetitionTracker>;
  private lastRep: Repetition | null = null;
  private last: LiveState;

  constructor() {
    this.last = {
      landmarks: null,
      analysis: this.analyzer.process({ timestampMs: 0, landmarks: [] }),
      compensations: [],
      calibrated: false,
      posture: null,
      repCount: 0,
      lastRep: null,
    };
  }

  get state(): LiveState {
    return this.last;
  }

  process(landmarks: ScreenLandmark[], world: Vec3[] | undefined, nowMs: number, mode: MeasureMode): LiveState {
    const frame = { timestampMs: nowMs, landmarks, worldLandmarks: world };
    const analysis = this.analyzer.process(frame);
    const compensations = mode === 'posture' ? [] : this.compensation.process(frame);
    if (landmarks.length > 0) this.ghostRecorder.push(landmarks, nowMs);

    for (const j of JOINTS) {
      const m = analysis.joints[j.id];
      if (m.tracked && m.value !== null && !m.outOfPlane) {
        const rep = this.trackers[j.id].push(m.value, nowMs);
        if (rep && j.id === analysis.activeJointId) this.lastRep = rep;
      }
    }
    let posture: PostureAnalysis | null = null;
    if (mode === 'posture' && landmarks.length > 0) {
      const raw = analyzePosture(landmarks);
      posture = raw ? this.postureSmoother.push(raw) : null;
    }
    const active = analysis.activeJointId;
    this.last = {
      landmarks: landmarks.length > 0 ? landmarks : null,
      analysis,
      compensations,
      calibrated: this.compensation.hasBaseline,
      posture,
      repCount: active ? this.trackers[active].repetitions.length : 0,
      lastRep: this.lastRep,
    };
    return this.last;
  }

  restart(): void {
    this.analyzer.resetPeaks();
    this.compensation.resetBaseline();
    this.postureSmoother.reset();
    for (const t of Object.values(this.trackers)) t.reset();
    this.lastRep = null;
  }

  /** Changement de source : on repart de zéro (filtres, fantôme compris). */
  hardReset(): void {
    this.analyzer = new JointAnalyzer();
    this.ghostRecorder.reset();
    this.restart();
  }

  setFocus(id: JointId | null): void {
    this.analyzer.setFocus(id);
  }

  snapshot(): Snapshot {
    const sport = JOINTS.map((j) => summarizeRepetitions(j.id, this.trackers[j.id].repetitions)).filter(
      (s): s is SportSummary => s !== null,
    );
    return { analysis: this.last.analysis, sport, posture: this.last.posture, ghost: this.ghostRecorder.toTrack() };
  }
}
