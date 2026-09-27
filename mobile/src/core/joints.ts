import { PoseLandmark } from './landmarks';

export type Side = 'left' | 'right';
export type JointKind = 'shoulder' | 'elbow' | 'hip' | 'knee' | 'ankle';
export type JointId = `${JointKind}_${Side}`;

/**
 * Conversion de l'angle intérieur (0-180°) mesuré au sommet vers la valeur
 * goniométrique clinique :
 *  - flexion       : 180 − angle   (coude, genou, hanche ; 0° = extension)
 *  - elevation     : angle         (épaule : angle bras / tronc ; 0° = bras le long du corps)
 *  - dorsiflexion  : 90 − angle    (cheville ; > 0 flexion dorsale, < 0 flexion plantaire)
 */
export type AngleConvention = 'flexion' | 'elevation' | 'dorsiflexion';

export interface JointDefinition {
  id: JointId;
  kind: JointKind;
  /** Libellé court affiché sur les cartes (côté anatomique du patient). */
  label: string;
  /** Nom du mouvement mesuré (bilan, dictée). */
  movement: string;
  side: Side;
  /** Segment proximal → sommet → segment distal. */
  proximal: number;
  vertex: number;
  distal: number;
  convention: AngleConvention;
}

export const JOINT_KIND_LABELS: Record<JointKind, string> = {
  shoulder: 'Épaule',
  elbow: 'Coude',
  hip: 'Hanche',
  knee: 'Genou',
  ankle: 'Cheville',
};

const MOVEMENT: Record<JointKind, string> = {
  shoulder: 'Élévation (flexion/abduction)',
  elbow: 'Flexion',
  hip: 'Flexion',
  knee: 'Flexion',
  ankle: 'Flexion dorsale',
};

const CONVENTION: Record<JointKind, AngleConvention> = {
  shoulder: 'elevation',
  elbow: 'flexion',
  hip: 'flexion',
  knee: 'flexion',
  ankle: 'dorsiflexion',
};

const L = PoseLandmark;
const TRIPLETS: Record<JointKind, Record<Side, [number, number, number]>> = {
  shoulder: {
    left: [L.leftHip, L.leftShoulder, L.leftElbow],
    right: [L.rightHip, L.rightShoulder, L.rightElbow],
  },
  elbow: {
    left: [L.leftShoulder, L.leftElbow, L.leftWrist],
    right: [L.rightShoulder, L.rightElbow, L.rightWrist],
  },
  hip: {
    left: [L.leftShoulder, L.leftHip, L.leftKnee],
    right: [L.rightShoulder, L.rightHip, L.rightKnee],
  },
  knee: {
    left: [L.leftHip, L.leftKnee, L.leftAnkle],
    right: [L.rightHip, L.rightKnee, L.rightAnkle],
  },
  ankle: {
    left: [L.leftKnee, L.leftAnkle, L.leftFootIndex],
    right: [L.rightKnee, L.rightAnkle, L.rightFootIndex],
  },
};

export const JOINT_KINDS: ReadonlyArray<JointKind> = ['shoulder', 'elbow', 'hip', 'knee', 'ankle'];
export const SIDES: ReadonlyArray<Side> = ['left', 'right'];

export const JOINTS: ReadonlyArray<JointDefinition> = JOINT_KINDS.flatMap((kind) =>
  SIDES.map((side): JointDefinition => {
    const [proximal, vertex, distal] = TRIPLETS[kind][side];
    return {
      id: `${kind}_${side}`,
      kind,
      label: `${JOINT_KIND_LABELS[kind]} ${side === 'left' ? 'G' : 'D'}`,
      movement: MOVEMENT[kind],
      side,
      proximal,
      vertex,
      distal,
      convention: CONVENTION[kind],
    };
  }),
);

export const JOINTS_BY_ID: Readonly<Record<JointId, JointDefinition>> = Object.fromEntries(
  JOINTS.map((j) => [j.id, j]),
) as Record<JointId, JointDefinition>;

export function jointId(kind: JointKind, side: Side): JointId {
  return `${kind}_${side}`;
}

export function contralateral(id: JointId): JointId {
  const def = JOINTS_BY_ID[id];
  return jointId(def.kind, def.side === 'left' ? 'right' : 'left');
}

/** Angle intérieur → valeur clinique selon la convention de l'articulation. */
export function interiorToClinical(interior: number, convention: AngleConvention): number {
  switch (convention) {
    case 'flexion':
      return 180 - interior;
    case 'elevation':
      return interior;
    case 'dorsiflexion':
      return 90 - interior;
  }
}

/** Valeur clinique → angle intérieur (inverse de `interiorToClinical`). */
export function clinicalToInterior(value: number, convention: AngleConvention): number {
  switch (convention) {
    case 'flexion':
      return 180 - value;
    case 'elevation':
      return value;
    case 'dorsiflexion':
      return 90 - value;
  }
}

/** Raccourci historique : convention de flexion (0° = extension complète). */
export function interiorToFlexion(interiorAngle: number): number {
  return interiorToClinical(interiorAngle, 'flexion');
}
