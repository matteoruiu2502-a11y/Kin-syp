import { PoseLandmark } from './landmarks';

export type Side = 'left' | 'right';
export type JointId = 'elbow_left' | 'elbow_right' | 'knee_left' | 'knee_right';

export interface JointDefinition {
  id: JointId;
  /** Libellé court affiché sur les cartes (côté anatomique du patient). */
  label: string;
  side: Side;
  /** Segment proximal → sommet → segment distal. */
  proximal: number;
  vertex: number;
  distal: number;
  /**
   * Amplitude active de référence en flexion chez l'adulte (degrés),
   * utilisée pour colorer la jauge. Les normes par âge/sexe viendront
   * avec le module Bilan.
   */
  referenceFlexion: number;
}

export const JOINTS: ReadonlyArray<JointDefinition> = [
  {
    id: 'elbow_left',
    label: 'Coude G',
    side: 'left',
    proximal: PoseLandmark.leftShoulder,
    vertex: PoseLandmark.leftElbow,
    distal: PoseLandmark.leftWrist,
    referenceFlexion: 145,
  },
  {
    id: 'elbow_right',
    label: 'Coude D',
    side: 'right',
    proximal: PoseLandmark.rightShoulder,
    vertex: PoseLandmark.rightElbow,
    distal: PoseLandmark.rightWrist,
    referenceFlexion: 145,
  },
  {
    id: 'knee_left',
    label: 'Genou G',
    side: 'left',
    proximal: PoseLandmark.leftHip,
    vertex: PoseLandmark.leftKnee,
    distal: PoseLandmark.leftAnkle,
    referenceFlexion: 140,
  },
  {
    id: 'knee_right',
    label: 'Genou D',
    side: 'right',
    proximal: PoseLandmark.rightHip,
    vertex: PoseLandmark.rightKnee,
    distal: PoseLandmark.rightAnkle,
    referenceFlexion: 140,
  },
];

export const JOINTS_BY_ID: Readonly<Record<JointId, JointDefinition>> =
  Object.fromEntries(JOINTS.map((j) => [j.id, j])) as Record<JointId, JointDefinition>;

/**
 * Convention goniométrique : 0° = extension complète (segments alignés),
 * la valeur croît avec la flexion.
 */
export function interiorToFlexion(interiorAngle: number): number {
  return 180 - interiorAngle;
}
