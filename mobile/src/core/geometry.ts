import type { Point2, Vec3 } from './types';

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Angle intérieur (0-180°) au sommet `b` formé par les segments b→a et b→c,
 * calculé dans le plan de l'image. Les coordonnées doivent être isotropes
 * (pixels), jamais normalisées [0-1] sur des axes de tailles différentes.
 */
export function angle2D(a: Point2, b: Point2, c: Point2): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  // atan2(|cross|, dot) est numériquement stable près de 0° et 180°.
  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  if (cross === 0 && dot === 0) return NaN;
  return Math.atan2(Math.abs(cross), dot) * RAD_TO_DEG;
}

/** Angle intérieur (0-180°) au sommet `b` en 3D. */
export function angle3D(a: Vec3, b: Vec3, c: Vec3): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const cx = v1.y * v2.z - v1.z * v2.y;
  const cy = v1.z * v2.x - v1.x * v2.z;
  const cz = v1.x * v2.y - v1.y * v2.x;
  const crossNorm = Math.hypot(cx, cy, cz);
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  if (crossNorm === 0 && dot === 0) return NaN;
  return Math.atan2(crossNorm, dot) * RAD_TO_DEG;
}

/**
 * Inclinaison (0-180°) du segment `from`→`to` par rapport à la verticale
 * ascendante de l'écran (y croît vers le bas). 0° = parfaitement vertical.
 */
export function inclinationFromVertical(from: Point2, to: Point2): number {
  const dx = to.x - from.x;
  const dy = from.y - to.y; // inversion : "vers le haut" positif
  if (dx === 0 && dy === 0) return NaN;
  return Math.abs(Math.atan2(dx, dy)) * RAD_TO_DEG;
}

/**
 * Inclinaison (0-90°) de la droite passant par `a` et `b` par rapport à
 * l'horizontale, indépendamment du sens du segment.
 */
export function tiltFromHorizontal(a: Point2, b: Point2): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (dx === 0 && dy === 0) return NaN;
  return Math.atan2(dy, dx) * RAD_TO_DEG;
}

export function midpoint(a: Point2, b: Point2): Point2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
