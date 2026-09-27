/**
 * Filtre "One Euro" (Casiez et al., CHI 2012) : lisse fortement le bruit
 * quand le membre est immobile, et réduit la latence quand il bouge vite.
 * Idéal pour afficher un angle stable sans retard perceptible.
 */
export interface OneEuroParams {
  /** Fréquence de coupure minimale (Hz). Plus bas = plus lisse au repos. */
  minCutoff: number;
  /** Sensibilité à la vitesse. Plus haut = moins de retard en mouvement. */
  beta: number;
  /** Fréquence de coupure pour la dérivée (Hz). */
  derivativeCutoff: number;
}

export const DEFAULT_ANGLE_FILTER: OneEuroParams = {
  minCutoff: 1.0,
  beta: 0.02,
  derivativeCutoff: 1.0,
};

function smoothingFactor(cutoffHz: number, dtSeconds: number): number {
  const r = 2 * Math.PI * cutoffHz * dtSeconds;
  return r / (r + 1);
}

export class OneEuroFilter {
  private lastValue: number | null = null;
  private lastDerivative = 0;
  private lastTimestampMs: number | null = null;

  constructor(private readonly params: OneEuroParams = DEFAULT_ANGLE_FILTER) {}

  reset(): void {
    this.lastValue = null;
    this.lastDerivative = 0;
    this.lastTimestampMs = null;
  }

  filter(value: number, timestampMs: number): number {
    if (this.lastValue === null || this.lastTimestampMs === null) {
      this.lastValue = value;
      this.lastTimestampMs = timestampMs;
      return value;
    }
    // Garde-fou : horodatages identiques ou non monotones.
    const dt = Math.max((timestampMs - this.lastTimestampMs) / 1000, 1e-3);
    const rawDerivative = (value - this.lastValue) / dt;
    const aD = smoothingFactor(this.params.derivativeCutoff, dt);
    const derivative = aD * rawDerivative + (1 - aD) * this.lastDerivative;
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(derivative);
    const a = smoothingFactor(cutoff, dt);
    const filtered = a * value + (1 - a) * this.lastValue;

    this.lastValue = filtered;
    this.lastDerivative = derivative;
    this.lastTimestampMs = timestampMs;
    return filtered;
  }

  /** Vitesse angulaire filtrée (°/s) de la dernière mise à jour. */
  get velocity(): number {
    return this.lastDerivative;
  }
}
