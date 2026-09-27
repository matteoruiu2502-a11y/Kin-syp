import { distance, midpoint } from './geometry';
import { PoseLandmark as L } from './landmarks';
import type { Point2, ScreenLandmark } from './types';

/**
 * "Mode fantôme" : on enregistre le squelette d'une séance (et non la vidéo :
 * plus léger et sans image identifiante du patient), exprimé dans un repère
 * lié au corps. À la séance suivante, il est rejoué en transparence et
 * recalé sur le patient en direct (bassin, taille du tronc).
 */
export interface GhostFrame {
  /** Temps depuis le début de l'enregistrement (ms). */
  t: number;
  /** [x, y, visibilité] par repère, dans le repère corps. */
  p: Array<[number, number, number]>;
}

export interface GhostTrack {
  version: 1;
  durationMs: number;
  frames: GhostFrame[];
}

interface BodyFrame {
  origin: Point2;
  scale: number;
}

const MIN_VIS = 0.5;

/** Repère corps : origine au milieu du bassin, unité = longueur du tronc. */
export function bodyFrame(lm: ScreenLandmark[]): BodyFrame | null {
  const ls = lm[L.leftShoulder];
  const rs = lm[L.rightShoulder];
  const lh = lm[L.leftHip];
  const rh = lm[L.rightHip];
  if (!ls || !rs || !lh || !rh) return null;
  if (Math.min(ls.visibility, rs.visibility, lh.visibility, rh.visibility) < MIN_VIS) {
    // En profil, un seul côté visible suffit à estimer le repère.
    if (Math.max(ls.visibility, rs.visibility) < MIN_VIS || Math.max(lh.visibility, rh.visibility) < MIN_VIS) {
      return null;
    }
  }
  const origin = midpoint(lh, rh);
  const scale = distance(midpoint(ls, rs), origin);
  if (scale < 1) return null;
  return { origin, scale };
}

export function toBodySpace(lm: ScreenLandmark[], frame: BodyFrame): GhostFrame['p'] {
  return lm.map((p) => [
    round3((p.x - frame.origin.x) / frame.scale),
    round3((p.y - frame.origin.y) / frame.scale),
    round3(p.visibility),
  ]);
}

export function fromBodySpace(points: GhostFrame['p'], frame: BodyFrame): ScreenLandmark[] {
  return points.map(([x, y, v]) => ({
    x: frame.origin.x + x * frame.scale,
    y: frame.origin.y + y * frame.scale,
    visibility: v,
  }));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Enregistreur circulaire : conserve les `maxDurationMs` dernières
 * millisecondes à `fps` images/s. Le fantôme sauvegardé correspond donc au
 * dernier mouvement effectué avant "Enregistrer".
 */
export class GhostRecorder {
  private frames: Array<{ ts: number; p: GhostFrame['p'] }> = [];
  private lastTs = -Infinity;

  constructor(
    private readonly fps = 15,
    private readonly maxDurationMs = 15_000,
  ) {}

  reset(): void {
    this.frames = [];
    this.lastTs = -Infinity;
  }

  push(lm: ScreenLandmark[], timestampMs: number): void {
    if (timestampMs - this.lastTs < 1000 / this.fps - 1) return;
    const frame = bodyFrame(lm);
    if (!frame) return;
    this.lastTs = timestampMs;
    this.frames.push({ ts: timestampMs, p: toBodySpace(lm, frame) });
    const cutoff = timestampMs - this.maxDurationMs;
    while (this.frames.length > 0 && this.frames[0].ts < cutoff) this.frames.shift();
  }

  get length(): number {
    return this.frames.length;
  }

  toTrack(): GhostTrack | null {
    if (this.frames.length < 2) return null;
    const t0 = this.frames[0].ts;
    const frames = this.frames.map((f) => ({ t: f.ts - t0, p: f.p }));
    return { version: 1, durationMs: frames[frames.length - 1].t, frames };
  }
}

/** Image du fantôme à l'instant `elapsedMs` (lecture en boucle). */
export function ghostFrameAt(track: GhostTrack, elapsedMs: number): GhostFrame {
  if (track.durationMs <= 0) return track.frames[0];
  const t = ((elapsedMs % track.durationMs) + track.durationMs) % track.durationMs;
  // Recherche dichotomique de la dernière image ≤ t.
  let lo = 0;
  let hi = track.frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track.frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return track.frames[lo];
}

/**
 * Place le fantôme sur l'écran : recalé sur le patient en direct s'il est
 * détecté, sinon centré dans la vue avec une taille par défaut.
 */
export function projectGhost(
  frame: GhostFrame,
  live: ScreenLandmark[] | null,
  view: { width: number; height: number },
): ScreenLandmark[] {
  const liveFrame = live ? bodyFrame(live) : null;
  const target = liveFrame ?? {
    origin: { x: view.width / 2, y: view.height * 0.55 },
    scale: view.height * 0.22,
  };
  return fromBodySpace(frame.p, target);
}
