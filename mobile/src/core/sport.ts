import { JOINT_KINDS, JOINT_KIND_LABELS, jointId, type JointId, type JointKind } from './joints';

/**
 * Indice de symétrie des membres (LSI, Limb Symmetry Index) :
 * côté le plus faible / côté le plus fort × 100. Un LSI ≥ 90 % est le
 * critère usuel de reprise sportive ; l'asymétrie vaut 100 − LSI.
 */
export interface SymmetryResult {
  kind: JointKind;
  label: string;
  left: number;
  right: number;
  lsi: number;
  asymmetryPercent: number;
  weakerSide: 'left' | 'right' | null;
}

export const LSI_RETURN_TO_SPORT = 90;

export function symmetry(kind: JointKind, left: number, right: number): SymmetryResult {
  const strong = Math.max(Math.abs(left), Math.abs(right));
  const weak = Math.min(Math.abs(left), Math.abs(right));
  const lsi = strong === 0 ? 100 : (weak / strong) * 100;
  const weakerSide = Math.abs(left) === Math.abs(right) ? null : Math.abs(left) < Math.abs(right) ? 'left' : 'right';
  return {
    kind,
    label: JOINT_KIND_LABELS[kind],
    left,
    right,
    lsi: Math.round(lsi * 10) / 10,
    asymmetryPercent: Math.round((100 - lsi) * 10) / 10,
    weakerSide,
  };
}

/** Symétries G/D pour toutes les articulations dont les deux côtés ont une valeur. */
export function symmetries(values: Partial<Record<JointId, number | null>>): SymmetryResult[] {
  const out: SymmetryResult[] = [];
  for (const kind of JOINT_KINDS) {
    const l = values[jointId(kind, 'left')];
    const r = values[jointId(kind, 'right')];
    if (l !== null && l !== undefined && r !== null && r !== undefined) {
      out.push(symmetry(kind, l, r));
    }
  }
  return out;
}

export interface Repetition {
  /** Début du mouvement (ms). */
  startMs: number;
  /** Instant du pic (ms). */
  peakMs: number;
  /** Retour en position de départ (ms). */
  endMs: number;
  /** Amplitude parcourue (°). */
  range: number;
  peakValue: number;
  /** Vitesse angulaire maximale (°/s). */
  peakVelocity: number;
  /** Vitesse moyenne de la phase aller (°/s). */
  meanVelocity: number;
}

export interface RepetitionOptions {
  /** Amplitude minimale (°) pour valider une répétition. */
  minRange: number;
  /** Marge (°) de sortie/retour de la zone de départ. */
  margin: number;
}

const DEFAULT_REP_OPTIONS: RepetitionOptions = { minRange: 20, margin: 8 };

/**
 * Détecte les répétitions sur le signal d'une articulation : départ quand la
 * valeur quitte la zone basse, pic, puis fin au retour en zone basse.
 * Mesure la durée et la vitesse d'exécution de chaque répétition.
 */
export class RepetitionTracker {
  private readonly options: RepetitionOptions;
  private low: number | null = null;
  private inRep = false;
  private startMs = 0;
  private startValue = 0;
  private peakValue = -Infinity;
  private peakMs = 0;
  private peakVelocity = 0;
  private lastValue: number | null = null;
  private lastMs: number | null = null;
  readonly repetitions: Repetition[] = [];

  constructor(options: Partial<RepetitionOptions> = {}) {
    this.options = { ...DEFAULT_REP_OPTIONS, ...options };
  }

  reset(): void {
    this.low = null;
    this.inRep = false;
    this.lastValue = null;
    this.lastMs = null;
    this.repetitions.length = 0;
  }

  /** Renvoie la répétition terminée sur cette image, le cas échéant. */
  push(value: number, timestampMs: number): Repetition | null {
    const { margin, minRange } = this.options;
    let velocity = 0;
    if (this.lastValue !== null && this.lastMs !== null && timestampMs > this.lastMs) {
      velocity = ((value - this.lastValue) / (timestampMs - this.lastMs)) * 1000;
    }
    this.lastValue = value;
    this.lastMs = timestampMs;

    if (!this.inRep) {
      // La zone basse suit la position de repos (minimum glissant).
      if (this.low === null || value < this.low) this.low = value;
      if (value > this.low + margin) {
        this.inRep = true;
        this.startMs = timestampMs;
        this.startValue = this.low;
        this.peakValue = value;
        this.peakMs = timestampMs;
        this.peakVelocity = Math.abs(velocity);
      }
      return null;
    }

    this.peakVelocity = Math.max(this.peakVelocity, Math.abs(velocity));
    if (value > this.peakValue) {
      this.peakValue = value;
      this.peakMs = timestampMs;
    }

    if (value <= this.startValue + margin) {
      this.inRep = false;
      this.low = value;
      const range = this.peakValue - this.startValue;
      if (range < minRange) return null;
      const upS = Math.max((this.peakMs - this.startMs) / 1000, 1e-3);
      const rep: Repetition = {
        startMs: this.startMs,
        peakMs: this.peakMs,
        endMs: timestampMs,
        range,
        peakValue: this.peakValue,
        peakVelocity: this.peakVelocity,
        meanVelocity: range / upS,
      };
      this.repetitions.push(rep);
      return rep;
    }
    return null;
  }
}

export interface SportSummary {
  jointId: JointId;
  count: number;
  meanDurationS: number;
  meanPeakVelocity: number;
  bestPeakVelocity: number;
  meanRange: number;
}

export function summarizeRepetitions(jointIdValue: JointId, reps: Repetition[]): SportSummary | null {
  if (reps.length === 0) return null;
  const avg = (f: (r: Repetition) => number) => reps.reduce((a, r) => a + f(r), 0) / reps.length;
  return {
    jointId: jointIdValue,
    count: reps.length,
    meanDurationS: Math.round(avg((r) => (r.endMs - r.startMs) / 1000) * 100) / 100,
    meanPeakVelocity: Math.round(avg((r) => r.peakVelocity)),
    bestPeakVelocity: Math.round(Math.max(...reps.map((r) => r.peakVelocity))),
    meanRange: Math.round(avg((r) => r.range)),
  };
}
