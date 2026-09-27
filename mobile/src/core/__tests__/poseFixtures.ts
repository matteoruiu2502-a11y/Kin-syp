import { PoseLandmark, POSE_LANDMARK_COUNT } from '../landmarks';
import type { Point2, PoseFrame, ScreenLandmark, Vec3 } from '../types';

const DEG = Math.PI / 180;

/** Point situé à `length` px de `origin`, dans la direction `angleDeg` (0° = bas, sens trigo écran). */
export function polar(origin: Point2, length: number, angleDeg: number): Point2 {
  return {
    x: origin.x + length * Math.sin(angleDeg * DEG),
    y: origin.y + length * Math.cos(angleDeg * DEG),
  };
}

export interface PoseSpec {
  /** Flexion du coude droit (°) dans le plan de l'image. */
  rightElbowFlexion?: number;
  leftElbowFlexion?: number;
  rightKneeFlexion?: number;
  leftKneeFlexion?: number;
  /** Inclinaison du tronc (°) par rapport à la verticale. */
  trunkLeanDeg?: number;
  /** Bascule du bassin (°) : la hanche gauche monte. */
  pelvisTiltDeg?: number;
  visibility?: number;
  timestampMs?: number;
  world?: Vec3[];
}

/** Patient debout de face, bras le long du corps, construit en pixels écran. */
export function makeFrame(spec: PoseSpec = {}): PoseFrame {
  const vis = spec.visibility ?? 0.99;
  const pts: Point2[] = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x: 500, y: 200 }));

  const hipMid = { x: 500, y: 600 };
  const pelvisHalf = 60;
  const pelvisTilt = (spec.pelvisTiltDeg ?? 0) * DEG;
  // Patient face caméra : sa gauche est à droite de l'image.
  const lh = { x: hipMid.x + pelvisHalf * Math.cos(pelvisTilt), y: hipMid.y - pelvisHalf * Math.sin(pelvisTilt) };
  const rh = { x: hipMid.x - pelvisHalf * Math.cos(pelvisTilt), y: hipMid.y + pelvisHalf * Math.sin(pelvisTilt) };

  const trunk = (spec.trunkLeanDeg ?? 0) * DEG;
  const shoulderMid = { x: hipMid.x + 300 * Math.sin(trunk), y: hipMid.y - 300 * Math.cos(trunk) };
  const ls = { x: shoulderMid.x + 90, y: shoulderMid.y };
  const rs = { x: shoulderMid.x - 90, y: shoulderMid.y };

  // Bras : humérus vertical, avant-bras qui fléchit vers l'avant (dans le plan).
  const le = polar(ls, 150, 0);
  const re = polar(rs, 150, 0);
  const lw = polar(le, 130, spec.leftElbowFlexion ?? 0);
  const rw = polar(re, 130, -(spec.rightElbowFlexion ?? 0));
  // Jambes.
  const lk = polar(lh, 220, 0);
  const rk = polar(rh, 220, 0);
  const la = polar(lk, 210, spec.leftKneeFlexion ?? 0);
  const ra = polar(rk, 210, -(spec.rightKneeFlexion ?? 0));

  pts[PoseLandmark.leftShoulder] = ls;
  pts[PoseLandmark.rightShoulder] = rs;
  pts[PoseLandmark.leftElbow] = le;
  pts[PoseLandmark.rightElbow] = re;
  pts[PoseLandmark.leftWrist] = lw;
  pts[PoseLandmark.rightWrist] = rw;
  pts[PoseLandmark.leftHip] = lh;
  pts[PoseLandmark.rightHip] = rh;
  pts[PoseLandmark.leftKnee] = lk;
  pts[PoseLandmark.rightKnee] = rk;
  pts[PoseLandmark.leftAnkle] = la;
  pts[PoseLandmark.rightAnkle] = ra;

  const landmarks: ScreenLandmark[] = pts.map((p) => ({ ...p, visibility: vis }));
  return { timestampMs: spec.timestampMs ?? 0, landmarks, worldLandmarks: spec.world };
}

/** Coordonnées "monde" cohérentes avec l'image (mêmes proportions, z = 0). */
export function worldFromFrame(frame: PoseFrame, zOverrides: Record<number, number> = {}): Vec3[] {
  return frame.landmarks.map((p, i) => ({ x: p.x / 1000, y: p.y / 1000, z: zOverrides[i] ?? 0 }));
}
