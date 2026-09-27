import { distance, inclinationFromVertical, midpoint } from './geometry';
import { PoseLandmark as L } from './landmarks';
import type { Point2, ScreenLandmark } from './types';

export type PostureView = 'front' | 'profile';

export interface PostureMetric {
  key: string;
  label: string;
  value: number;
  unit: '°' | '%';
  /** Précision lisible : côté le plus haut, sens du décalage… */
  detail: string;
  status: 'ok' | 'warn';
}

export interface PostureAnalysis {
  view: PostureView;
  metrics: PostureMetric[];
  /** Ligne de gravité (fil à plomb) en coordonnées écran, pour l'affichage. */
  plumbLine: { top: Point2; bottom: Point2 } | null;
}

export const POSTURE_THRESHOLDS = {
  shoulderTiltDeg: 2,
  pelvisTiltDeg: 2,
  headTiltDeg: 3,
  lateralShiftPercent: 5,
  forwardHeadDeg: 15,
  trunkLeanDeg: 5,
  plumbOffsetPercent: 5,
} as const;

const MIN_VIS = 0.5;

function vis(lm: ScreenLandmark | undefined): lm is ScreenLandmark {
  return lm !== undefined && lm.visibility >= MIN_VIS;
}

/**
 * Inclinaison signée d'une ligne gauche-droite. > 0 : le côté gauche du
 * patient est plus haut (y écran plus petit).
 */
function signedTilt(left: Point2, right: Point2): number {
  const dx = Math.abs(left.x - right.x);
  const dy = right.y - left.y; // > 0 si la gauche est plus haute
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function sideDetail(tilt: number, what: string): string {
  if (Math.abs(tilt) < 0.5) return `${what} horizontal(es)`;
  return `${what} ${tilt > 0 ? 'gauche' : 'droit(e)'} plus haut(e)`;
}

/**
 * Vue de face si la largeur des épaules est significative par rapport à la
 * hauteur du tronc ; sinon vue de profil.
 */
export function detectView(lm: ScreenLandmark[]): PostureView | null {
  const ls = lm[L.leftShoulder];
  const rs = lm[L.rightShoulder];
  const lh = lm[L.leftHip];
  const rh = lm[L.rightHip];
  if (!ls || !rs || !lh || !rh) return null;
  const trunk = distance(midpoint(ls, rs), midpoint(lh, rh));
  if (trunk === 0) return null;
  return distance(ls, rs) / trunk > 0.45 ? 'front' : 'profile';
}

function metric(
  key: string,
  label: string,
  value: number,
  unit: '°' | '%',
  detail: string,
  threshold: number,
): PostureMetric {
  return {
    key,
    label,
    value: Math.round(value * 10) / 10,
    unit,
    detail,
    status: Math.abs(value) > threshold ? 'warn' : 'ok',
  };
}

function analyzeFront(lm: ScreenLandmark[]): PostureAnalysis {
  const T = POSTURE_THRESHOLDS;
  const metrics: PostureMetric[] = [];
  const ls = lm[L.leftShoulder];
  const rs = lm[L.rightShoulder];
  const lh = lm[L.leftHip];
  const rh = lm[L.rightHip];

  if (vis(ls) && vis(rs)) {
    const t = signedTilt(ls, rs);
    metrics.push(metric('shoulders', 'Épaules', t, '°', sideDetail(t, 'Épaule'), T.shoulderTiltDeg));
  }
  if (vis(lh) && vis(rh)) {
    const t = signedTilt(lh, rh);
    metrics.push(metric('pelvis', 'Bassin', t, '°', sideDetail(t, 'Hanche'), T.pelvisTiltDeg));
  }
  const le = lm[L.leftEar];
  const re = lm[L.rightEar];
  const lEye = lm[L.leftEye];
  const rEye = lm[L.rightEye];
  const headL = vis(le) && vis(re) ? le : vis(lEye) && vis(rEye) ? lEye : null;
  const headR = headL === le ? re : rEye;
  if (headL && headR) {
    const t = signedTilt(headL, headR);
    metrics.push(
      metric('head', 'Tête', t, '°', Math.abs(t) < 0.5 ? 'Tête droite' : `Inclinée vers la ${t > 0 ? 'droite' : 'gauche'}`, T.headTiltDeg),
    );
  }

  let plumbLine: PostureAnalysis['plumbLine'] = null;
  const la = lm[L.leftAnkle];
  const ra = lm[L.rightAnkle];
  if (vis(ls) && vis(rs) && vis(lh) && vis(rh)) {
    const sMid = midpoint(ls, rs);
    const hMid = midpoint(lh, rh);
    const width = distance(ls, rs);
    const base = vis(la) && vis(ra) ? midpoint(la, ra) : hMid;
    // Décalage latéral du centre des épaules par rapport à la base d'appui,
    // projeté sur l'axe droite→gauche du patient (indépendant du miroir caméra).
    const axis = { x: (ls.x - rs.x) / width, y: (ls.y - rs.y) / width };
    const shift = (((sMid.x - base.x) * axis.x + (sMid.y - base.y) * axis.y) / width) * 100;
    metrics.push(
      metric(
        'lateral_shift',
        'Translation du tronc',
        shift,
        '%',
        Math.abs(shift) < 1 ? 'Tronc centré' : `Déport vers la ${shift > 0 ? 'gauche' : 'droite'}`,
        T.lateralShiftPercent,
      ),
    );
    const top = vis(lm[L.nose]) ? { x: base.x, y: lm[L.nose].y } : { x: base.x, y: sMid.y };
    plumbLine = { top, bottom: base };
  }
  return { view: 'front', metrics, plumbLine };
}

function analyzeProfile(lm: ScreenLandmark[]): PostureAnalysis {
  const T = POSTURE_THRESHOLDS;
  // Côté le mieux vu par la caméra.
  const leftScore = [L.leftEar, L.leftShoulder, L.leftHip, L.leftAnkle].reduce((a, i) => a + (lm[i]?.visibility ?? 0), 0);
  const rightScore = [L.rightEar, L.rightShoulder, L.rightHip, L.rightAnkle].reduce((a, i) => a + (lm[i]?.visibility ?? 0), 0);
  const left = leftScore >= rightScore;
  const ear = lm[left ? L.leftEar : L.rightEar];
  const shoulder = lm[left ? L.leftShoulder : L.rightShoulder];
  const hip = lm[left ? L.leftHip : L.rightHip];
  const ankle = lm[left ? L.leftAnkle : L.rightAnkle];
  const nose = lm[L.nose];
  const metrics: PostureMetric[] = [];

  // Sens "avant" : du tragus vers le nez.
  const forwardSign = vis(nose) && vis(ear) ? Math.sign(nose.x - ear.x) || 1 : 1;

  if (vis(ear) && vis(shoulder)) {
    const angle = inclinationFromVertical(shoulder, ear);
    const forward = (ear.x - shoulder.x) * forwardSign > 0;
    metrics.push(
      metric('forward_head', 'Antéposition de la tête', forward ? angle : 0, '°', forward ? 'Tête en avant des épaules' : 'Tête alignée', T.forwardHeadDeg),
    );
  }
  if (vis(shoulder) && vis(hip)) {
    const angle = inclinationFromVertical(hip, shoulder);
    const forward = (shoulder.x - hip.x) * forwardSign > 0;
    metrics.push(
      metric('trunk_lean', 'Inclinaison du tronc', angle, '°', angle < 1 ? 'Tronc vertical' : forward ? 'Penché en avant' : 'Penché en arrière', T.trunkLeanDeg),
    );
  }

  let plumbLine: PostureAnalysis['plumbLine'] = null;
  if (vis(ankle) && vis(shoulder) && vis(hip)) {
    const height = Math.abs(ankle.y - (vis(ear) ? ear.y : shoulder.y)) || 1;
    const offset = (((shoulder.x - ankle.x) * forwardSign) / height) * 100;
    metrics.push(
      metric('plumb_shoulder', 'Épaule / fil à plomb', offset, '%', offset > 0 ? 'En avant de la cheville' : 'En arrière de la cheville', T.plumbOffsetPercent),
    );
    const hipOffset = (((hip.x - ankle.x) * forwardSign) / height) * 100;
    metrics.push(
      metric('plumb_hip', 'Bassin / fil à plomb', hipOffset, '%', hipOffset > 0 ? 'Bassin antérieur' : 'Bassin postérieur', T.plumbOffsetPercent),
    );
    plumbLine = { top: { x: ankle.x, y: vis(ear) ? ear.y : shoulder.y }, bottom: ankle };
  }
  return { view: 'profile', metrics, plumbLine };
}

export function analyzePosture(lm: ScreenLandmark[], forcedView?: PostureView): PostureAnalysis | null {
  const view = forcedView ?? detectView(lm);
  if (!view) return null;
  return view === 'front' ? analyzeFront(lm) : analyzeProfile(lm);
}

/**
 * Lissage exponentiel des métriques posturales (l'analyse image par image
 * tremble ; le praticien a besoin d'une valeur stable pour le bilan).
 */
export class PostureSmoother {
  private values = new Map<string, number>();
  private lastView: PostureView | null = null;

  constructor(private readonly alpha = 0.15) {}

  reset(): void {
    this.values.clear();
    this.lastView = null;
  }

  push(analysis: PostureAnalysis): PostureAnalysis {
    if (analysis.view !== this.lastView) {
      this.values.clear();
      this.lastView = analysis.view;
    }
    const T = POSTURE_THRESHOLDS;
    const thresholds: Record<string, number> = {
      shoulders: T.shoulderTiltDeg,
      pelvis: T.pelvisTiltDeg,
      head: T.headTiltDeg,
      lateral_shift: T.lateralShiftPercent,
      forward_head: T.forwardHeadDeg,
      trunk_lean: T.trunkLeanDeg,
      plumb_shoulder: T.plumbOffsetPercent,
      plumb_hip: T.plumbOffsetPercent,
    };
    const metrics = analysis.metrics.map((m) => {
      const prev = this.values.get(m.key);
      const v = prev === undefined ? m.value : prev + this.alpha * (m.value - prev);
      this.values.set(m.key, v);
      const threshold = thresholds[m.key] ?? Infinity;
      return {
        ...m,
        value: Math.round(v * 10) / 10,
        status: Math.abs(v) > threshold ? ('warn' as const) : ('ok' as const),
      };
    });
    return { ...analysis, metrics };
  }
}
