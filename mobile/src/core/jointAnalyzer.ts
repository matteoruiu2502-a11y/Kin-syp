import { angle2D, angle3D } from './geometry';
import { JOINTS, type JointDefinition, type JointId, interiorToClinical } from './joints';
import { DEFAULT_ANGLE_FILTER, OneEuroFilter, type OneEuroParams } from './oneEuroFilter';
import type { Point2, PoseFrame } from './types';

export interface JointMeasurement {
  id: JointId;
  /** Les 3 repères de l'articulation sont visibles sur cette image. */
  tracked: boolean;
  /**
   * Valeur clinique lissée (°) selon la convention de l'articulation
   * (voir `AngleConvention`). Null si jamais mesurée ou perdue.
   */
  value: number | null;
  /** Valeur maximale atteinte depuis la dernière remise à zéro (ex. flexion max). */
  peak: number | null;
  /** Valeur minimale atteinte depuis la remise à zéro (ex. meilleure extension). */
  min: number | null;
  /**
   * Le mouvement sort du plan de la caméra : l'angle projeté 2D diverge
   * de l'estimation 3D. La mesure est alors peu fiable (repositionner la tablette).
   */
  outOfPlane: boolean;
  /** Position écran du sommet (pour placer l'étiquette d'angle). */
  vertex: Point2 | null;
  /** Vitesse angulaire filtrée (°/s). */
  velocity: number;
}

export interface JointAnalysis {
  joints: Record<JointId, JointMeasurement>;
  /** Articulation mise en avant : verrouillée par le praticien ou détectée automatiquement. */
  activeJointId: JointId | null;
  focusLocked: boolean;
}

export interface JointAnalyzerOptions {
  minVisibility: number;
  /** Au-delà, la mesure est considérée perdue et le filtre réinitialisé. */
  lostTimeoutMs: number;
  /** Écart 2D/3D (°) au-delà duquel on signale un mouvement hors plan. */
  outOfPlaneThresholdDeg: number;
  /** Constante de temps (s) de la moyenne d'activité utilisée pour l'auto-focus. */
  activityTimeConstantS: number;
  /** Vitesse moyenne minimale (°/s) pour qu'une articulation soit jugée "en mouvement". */
  activityThreshold: number;
  /** Ratio d'hystérésis pour changer d'articulation active (évite le clignotement). */
  switchRatio: number;
  filter: OneEuroParams;
}

export const DEFAULT_ANALYZER_OPTIONS: JointAnalyzerOptions = {
  minVisibility: 0.5,
  lostTimeoutMs: 500,
  outOfPlaneThresholdDeg: 20,
  activityTimeConstantS: 0.6,
  activityThreshold: 15,
  switchRatio: 1.5,
  filter: DEFAULT_ANGLE_FILTER,
};

interface JointState {
  def: JointDefinition;
  filter2D: OneEuroFilter;
  filter3D: OneEuroFilter;
  lastSeenMs: number | null;
  activity: number;
  measurement: JointMeasurement;
}

function emptyMeasurement(id: JointId): JointMeasurement {
  return {
    id,
    tracked: false,
    value: null,
    peak: null,
    min: null,
    outOfPlane: false,
    vertex: null,
    velocity: 0,
  };
}

/**
 * Transforme un flux de poses en mesures goniométriques stables (épaules,
 * coudes, hanches, genoux, chevilles) : lissage, suivi des amplitudes extrêmes (capture
 * automatique du pic, "zéro clic") et détection de l'articulation en mouvement.
 */
export class JointAnalyzer {
  private readonly options: JointAnalyzerOptions;
  private readonly states: JointState[];
  private activeJointId: JointId | null = null;
  private lockedJointId: JointId | null = null;
  private lastTimestampMs: number | null = null;

  constructor(options: Partial<JointAnalyzerOptions> = {}) {
    this.options = { ...DEFAULT_ANALYZER_OPTIONS, ...options };
    this.states = JOINTS.map((def) => ({
      def,
      filter2D: new OneEuroFilter(this.options.filter),
      filter3D: new OneEuroFilter(this.options.filter),
      lastSeenMs: null,
      activity: 0,
      measurement: emptyMeasurement(def.id),
    }));
  }

  /** Verrouille l'affichage principal sur une articulation (null = auto). */
  setFocus(id: JointId | null): void {
    this.lockedJointId = id;
    if (id) this.activeJointId = id;
  }

  /** Remet à zéro les amplitudes min/max (nouvelle série de mesures). */
  resetPeaks(): void {
    for (const s of this.states) {
      s.measurement = {
        ...s.measurement,
        peak: s.measurement.value,
        min: s.measurement.value,
      };
    }
  }

  process(frame: PoseFrame): JointAnalysis {
    const dtS =
      this.lastTimestampMs === null
        ? 0
        : Math.max(0, (frame.timestampMs - this.lastTimestampMs) / 1000);
    this.lastTimestampMs = frame.timestampMs;

    for (const s of this.states) {
      this.updateJoint(s, frame, dtS);
    }
    this.updateActiveJoint();

    const joints = {} as Record<JointId, JointMeasurement>;
    for (const s of this.states) joints[s.def.id] = s.measurement;
    return {
      joints,
      activeJointId: this.activeJointId,
      focusLocked: this.lockedJointId !== null,
    };
  }

  private updateJoint(s: JointState, frame: PoseFrame, dtS: number): void {
    const { def } = s;
    const { minVisibility, lostTimeoutMs, outOfPlaneThresholdDeg } = this.options;
    const a = frame.landmarks[def.proximal];
    const b = frame.landmarks[def.vertex];
    const c = frame.landmarks[def.distal];
    const visible =
      a !== undefined &&
      b !== undefined &&
      c !== undefined &&
      a.visibility >= minVisibility &&
      b.visibility >= minVisibility &&
      c.visibility >= minVisibility;

    const interior = visible ? angle2D(a, b, c) : NaN;

    if (!visible || Number.isNaN(interior)) {
      const lost =
        s.lastSeenMs === null || frame.timestampMs - s.lastSeenMs > lostTimeoutMs;
      if (lost) {
        s.filter2D.reset();
        s.filter3D.reset();
        s.activity = 0;
      }
      s.measurement = {
        ...s.measurement,
        tracked: false,
        value: lost ? null : s.measurement.value,
        vertex: lost ? null : s.measurement.vertex,
        outOfPlane: lost ? false : s.measurement.outOfPlane,
        velocity: 0,
      };
      return;
    }

    s.lastSeenMs = frame.timestampMs;
    const value = s.filter2D.filter(interiorToClinical(interior, def.convention), frame.timestampMs);
    const velocity = s.filter2D.velocity;

    let outOfPlane = false;
    const w = frame.worldLandmarks;
    if (w && w[def.proximal] && w[def.vertex] && w[def.distal]) {
      const interior3D = angle3D(w[def.proximal], w[def.vertex], w[def.distal]);
      if (!Number.isNaN(interior3D)) {
        const value3D = s.filter3D.filter(
          interiorToClinical(interior3D, def.convention),
          frame.timestampMs,
        );
        outOfPlane = Math.abs(value3D - value) > outOfPlaneThresholdDeg;
      }
    }

    // Moyenne exponentielle de |vitesse| pour l'auto-focus.
    const alpha = dtS > 0 ? 1 - Math.exp(-dtS / this.options.activityTimeConstantS) : 0;
    s.activity += alpha * (Math.abs(velocity) - s.activity);

    // Les extrêmes ne sont retenus que sur des mesures fiables (dans le plan).
    const prev = s.measurement;
    const peak = outOfPlane
      ? prev.peak
      : prev.peak === null
        ? value
        : Math.max(prev.peak, value);
    const min = outOfPlane
      ? prev.min
      : prev.min === null
        ? value
        : Math.min(prev.min, value);

    s.measurement = {
      id: def.id,
      tracked: true,
      value,
      peak,
      min,
      outOfPlane,
      vertex: { x: b.x, y: b.y },
      velocity,
    };
  }

  private updateActiveJoint(): void {
    if (this.lockedJointId) {
      this.activeJointId = this.lockedJointId;
      return;
    }
    const tracked = this.states.filter((s) => s.measurement.tracked);
    if (tracked.length === 0) return; // on garde le dernier focus

    const current = tracked.find((s) => s.def.id === this.activeJointId);
    const best = tracked.reduce((acc, s) => (s.activity > acc.activity ? s : acc));

    if (!current) {
      this.activeJointId = best.def.id;
      return;
    }
    if (
      best !== current &&
      best.activity >= this.options.activityThreshold &&
      best.activity > current.activity * this.options.switchRatio
    ) {
      this.activeJointId = best.def.id;
    }
  }
}
