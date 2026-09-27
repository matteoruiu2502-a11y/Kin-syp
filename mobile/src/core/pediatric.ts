import { clinicalToInterior, type JointDefinition } from './joints';
import type { Point2 } from './types';

/**
 * Mode pédiatrie : position à l'écran de la "cible" (étoile) que l'enfant
 * doit atteindre avec l'extrémité du membre pour réaliser l'amplitude visée.
 * La cible est placée sur le cercle décrit par le segment distal, dans le
 * sens du mouvement en cours.
 */
export function targetPoint(
  def: JointDefinition,
  proximal: Point2,
  vertex: Point2,
  distal: Point2,
  targetValue: number,
): Point2 | null {
  const px = proximal.x - vertex.x;
  const py = proximal.y - vertex.y;
  const dx = distal.x - vertex.x;
  const dy = distal.y - vertex.y;
  const np = Math.hypot(px, py);
  const nd = Math.hypot(dx, dy);
  if (np === 0 || nd === 0) return null;

  const interior = (clinicalToInterior(targetValue, def.convention) * Math.PI) / 180;
  // Sens de rotation : du segment proximal vers le segment distal actuel.
  const cross = px * dy - py * dx;
  const sign = cross >= 0 ? 1 : -1;
  const ux = px / np;
  const uy = py / np;
  const a = sign * interior;
  return {
    x: vertex.x + nd * (ux * Math.cos(a) - uy * Math.sin(a)),
    y: vertex.y + nd * (ux * Math.sin(a) + uy * Math.cos(a)),
  };
}

/** Progression [0-1] vers la cible, depuis la position de départ. */
export function progressToward(value: number, start: number, target: number): number {
  if (target === start) return value >= target ? 1 : 0;
  return Math.max(0, Math.min(1, (value - start) / (target - start)));
}
