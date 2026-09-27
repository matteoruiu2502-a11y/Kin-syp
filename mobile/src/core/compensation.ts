import { distance, inclinationFromVertical, midpoint, tiltFromHorizontal } from './geometry';
import { PoseLandmark } from './landmarks';
import type { PoseFrame, ScreenLandmark } from './types';

export type CompensationKind = 'trunk_lean' | 'pelvic_tilt';

export interface Compensation {
  kind: CompensationKind;
  message: string;
  /** Écart par rapport à la posture de référence (°). */
  deviationDeg: number;
  /** Repères à entourer en rouge à l'écran. */
  landmarks: number[];
}

export interface CompensationOptions {
  minVisibility: number;
  /** Nombre d'images valides moyennées pour établir la posture de référence. */
  baselineFrames: number;
  trunkThresholdDeg: number;
  pelvisThresholdDeg: number;
  /** L'alerte disparaît sous seuil × ratio (hystérésis anti-clignotement). */
  releaseRatio: number;
  /** Coefficient de lissage exponentiel des métriques posturales [0-1]. */
  smoothing: number;
  /**
   * Largeur minimale du bassin (relative à la longueur du tronc) pour
   * analyser l'obliquité : en vue de profil les hanches se superposent
   * et la mesure n'a pas de sens.
   */
  minPelvisWidthRatio: number;
}

export const DEFAULT_COMPENSATION_OPTIONS: CompensationOptions = {
  minVisibility: 0.5,
  baselineFrames: 15,
  trunkThresholdDeg: 10,
  pelvisThresholdDeg: 6,
  releaseRatio: 0.7,
  smoothing: 0.3,
  minPelvisWidthRatio: 0.35,
};

interface Metrics {
  trunk: number;
  pelvis: number | null;
}

const TRUNK_LANDMARKS = [
  PoseLandmark.leftShoulder,
  PoseLandmark.rightShoulder,
  PoseLandmark.leftHip,
  PoseLandmark.rightHip,
];
const PELVIS_LANDMARKS = [PoseLandmark.leftHip, PoseLandmark.rightHip];

/**
 * Détecte les compensations (le patient "triche") en comparant la posture
 * courante à une posture de référence capturée automatiquement au début
 * de la mesure. Relatif plutôt qu'absolu : fonctionne debout, assis ou allongé.
 */
export class CompensationDetector {
  private readonly options: CompensationOptions;
  private baselineSamples: Metrics[] = [];
  private baseline: Metrics | null = null;
  private smoothed: Metrics | null = null;
  private active = new Set<CompensationKind>();

  constructor(options: Partial<CompensationOptions> = {}) {
    this.options = { ...DEFAULT_COMPENSATION_OPTIONS, ...options };
  }

  get hasBaseline(): boolean {
    return this.baseline !== null;
  }

  /** Recapture la posture de référence (à appeler en début de série). */
  resetBaseline(): void {
    this.baselineSamples = [];
    this.baseline = null;
    this.smoothed = null;
    this.active.clear();
  }

  process(frame: PoseFrame): Compensation[] {
    const metrics = this.computeMetrics(frame.landmarks);
    if (!metrics) return [];

    if (!this.baseline) {
      this.baselineSamples.push(metrics);
      if (this.baselineSamples.length >= this.options.baselineFrames) {
        this.baseline = averageMetrics(this.baselineSamples);
        this.smoothed = { ...this.baseline };
      }
      return [];
    }

    const k = this.options.smoothing;
    const prev = this.smoothed ?? metrics;
    this.smoothed = {
      trunk: prev.trunk + k * (metrics.trunk - prev.trunk),
      pelvis:
        metrics.pelvis === null
          ? null
          : prev.pelvis === null
            ? metrics.pelvis
            : prev.pelvis + k * (metrics.pelvis - prev.pelvis),
    };

    const results: Compensation[] = [];
    const trunkDev = Math.abs(this.smoothed.trunk - this.baseline.trunk);
    if (this.isTriggered('trunk_lean', trunkDev, this.options.trunkThresholdDeg)) {
      results.push({
        kind: 'trunk_lean',
        message: 'Compensation du tronc détectée',
        deviationDeg: trunkDev,
        landmarks: TRUNK_LANDMARKS,
      });
    }

    if (this.smoothed.pelvis !== null && this.baseline.pelvis !== null) {
      const pelvisDev = Math.abs(this.smoothed.pelvis - this.baseline.pelvis);
      if (this.isTriggered('pelvic_tilt', pelvisDev, this.options.pelvisThresholdDeg)) {
        results.push({
          kind: 'pelvic_tilt',
          message: 'Bascule du bassin détectée',
          deviationDeg: pelvisDev,
          landmarks: PELVIS_LANDMARKS,
        });
      }
    } else {
      this.active.delete('pelvic_tilt');
    }

    return results;
  }

  private isTriggered(kind: CompensationKind, value: number, threshold: number): boolean {
    const wasActive = this.active.has(kind);
    const limit = wasActive ? threshold * this.options.releaseRatio : threshold;
    const triggered = value > limit;
    if (triggered) this.active.add(kind);
    else this.active.delete(kind);
    return triggered;
  }

  private computeMetrics(lm: ScreenLandmark[]): Metrics | null {
    const ls = lm[PoseLandmark.leftShoulder];
    const rs = lm[PoseLandmark.rightShoulder];
    const lh = lm[PoseLandmark.leftHip];
    const rh = lm[PoseLandmark.rightHip];
    if (!ls || !rs || !lh || !rh) return null;
    const v = this.options.minVisibility;
    // En vue de profil un seul côté est bien visible : on accepte qu'une
    // épaule et une hanche soient fiables, le milieu reste une bonne estimation.
    if (Math.max(ls.visibility, rs.visibility) < v || Math.max(lh.visibility, rh.visibility) < v) {
      return null;
    }
    const shoulderMid = midpoint(ls, rs);
    const hipMid = midpoint(lh, rh);
    const trunkLength = distance(shoulderMid, hipMid);
    if (trunkLength === 0) return null;
    const trunk = inclinationFromVertical(hipMid, shoulderMid);

    const bothHipsVisible = lh.visibility >= v && rh.visibility >= v;
    const pelvisWide = distance(lh, rh) / trunkLength >= this.options.minPelvisWidthRatio;
    const pelvis = bothHipsVisible && pelvisWide ? tiltFromHorizontal(lh, rh) : null;

    return { trunk, pelvis };
  }
}

function averageMetrics(samples: Metrics[]): Metrics {
  const trunk = samples.reduce((acc, m) => acc + m.trunk, 0) / samples.length;
  const pelvisSamples = samples.map((m) => m.pelvis).filter((p): p is number => p !== null);
  const pelvis =
    pelvisSamples.length > samples.length / 2
      ? pelvisSamples.reduce((acc, p) => acc + p, 0) / pelvisSamples.length
      : null;
  return { trunk, pelvis };
}
