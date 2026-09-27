import type { JointKind } from './joints';

export type Sex = 'F' | 'M';

/**
 * Amplitudes actives de référence de l'adulte (degrés), ordres de grandeur
 * usuels des tables de goniométrie (AAOS, Kapandji).
 *
 * ⚠ Valeurs INDICATIVES : les modulations âge/sexe ci-dessous reproduisent
 * les tendances décrites dans la littérature (amplitudes plus grandes chez
 * l'enfant et chez la femme, diminution progressive avec l'âge) mais doivent
 * être validées et, si besoin, remplacées par le référentiel du cabinet.
 * Ce fichier est l'unique source des normes utilisées par l'app et le bilan.
 */
export interface NormRange {
  /** Valeur maximale de référence du mouvement mesuré. */
  max: number;
  /** Valeur minimale de référence (extension / flexion plantaire), si pertinente. */
  min?: number;
}

const ADULT_NORMS: Record<JointKind, NormRange> = {
  shoulder: { max: 180 },
  elbow: { max: 145, min: 0 },
  hip: { max: 120, min: 0 },
  knee: { max: 140, min: 0 },
  ankle: { max: 20, min: -50 },
};

interface AgeBand {
  maxAge: number;
  label: string;
  factor: number;
}

const AGE_BANDS: ReadonlyArray<AgeBand> = [
  { maxAge: 8, label: '2-8 ans', factor: 1.06 },
  { maxAge: 19, label: '9-19 ans', factor: 1.03 },
  { maxAge: 44, label: '20-44 ans', factor: 1.0 },
  { maxAge: 69, label: '45-69 ans', factor: 0.96 },
  { maxAge: Infinity, label: '70 ans et +', factor: 0.9 },
];

const SEX_FACTOR: Record<Sex, number> = { F: 1.03, M: 1.0 };

export function ageBand(age: number): AgeBand {
  return AGE_BANDS.find((b) => age <= b.maxAge) ?? AGE_BANDS[AGE_BANDS.length - 1];
}

export interface Norm extends NormRange {
  ageBandLabel: string;
}

export function normFor(kind: JointKind, age: number, sex: Sex): Norm {
  const base = ADULT_NORMS[kind];
  const band = ageBand(age);
  const factor = band.factor * SEX_FACTOR[sex];
  return {
    max: Math.round(base.max * factor),
    min: base.min === undefined ? undefined : Math.round(base.min * factor),
    ageBandLabel: band.label,
  };
}

/** Âge révolu à une date donnée (dates ISO AAAA-MM-JJ). */
export function ageAt(birthDateIso: string, atIso: string): number {
  const b = new Date(birthDateIso);
  const d = new Date(atIso);
  let age = d.getFullYear() - b.getFullYear();
  const beforeBirthday =
    d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}

export type NormStatus = 'normal' | 'limited' | 'severe';

/** Pourcentage de la norme atteint et statut (≥ 90 % normal, ≥ 70 % limité). */
export function compareToNorm(value: number, norm: Norm): { percent: number; status: NormStatus } {
  const percent = norm.max === 0 ? 100 : Math.round((value / norm.max) * 100);
  const status: NormStatus = percent >= 90 ? 'normal' : percent >= 70 ? 'limited' : 'severe';
  return { percent, status };
}
