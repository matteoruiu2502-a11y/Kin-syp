// Calculateurs de quantités BTP et parcs & jardins : surfaces, volumes, tonnages, carrelage avec perte.

import { round2 } from "./money";

export const area = (length: number, width: number) => round2(Math.max(0, length) * Math.max(0, width));
/** Volume (m³) d'une couche : surface × épaisseur (cm). */
export const volume = (surfaceM2: number, thicknessCm: number) => round2((surfaceM2 * thicknessCm) / 100);

/** Masses volumiques indicatives (t/m³), modifiables dans le calculateur. */
export const DENSITY: Record<string, number> = {
  "Terre arable": 1.3,
  "Sable stabilisé": 1.8,
  "Gravier / concassé": 1.6,
  "Empierrement 0/32": 1.9,
  Béton: 2.4,
  "Paillis / écorces": 0.35,
};

/** Tonnage livré, avec foisonnement / tassement en %. */
export const tonnage = (volumeM3: number, density: number, compactionPercent = 0) => round2(volumeM3 * density * (1 + compactionPercent / 100));

export type TileResult = { tiles: number; boxes: number; m2Ordered: number; tileM2: number };
/** Carrelage : nombre de carreaux et de boîtes pour une surface, avec perte de découpe (%). */
export function tiles(surfaceM2: number, tileCmW: number, tileCmH: number, wastePercent: number, perBox = 0): TileResult {
  const tileM2 = (tileCmW * tileCmH) / 10000;
  if (!tileM2) return { tiles: 0, boxes: 0, m2Ordered: 0, tileM2: 0 };
  const n = Math.ceil((surfaceM2 * (1 + wastePercent / 100)) / tileM2 - 1e-9);
  const boxes = perBox > 0 ? Math.ceil(n / perBox) : 0;
  const ordered = perBox > 0 ? boxes * perBox : n;
  return { tiles: n, boxes, m2Ordered: round2(ordered * tileM2), tileM2: round2(tileM2) };
}
/** Conversion inverse : nombre de carreaux → m². */
export const tilesToM2 = (count: number, tileCmW: number, tileCmH: number) => round2((count * tileCmW * tileCmH) / 10000);

/** Gazon : semences (kg) pour une surface, à g/m². */
export const seedKg = (surfaceM2: number, gramsPerM2 = 35) => round2((surfaceM2 * gramsPerM2) / 1000);
/** Pavés / dalles : pièces par m² selon le format (cm) et perte. */
export const pavers = (surfaceM2: number, cmW: number, cmH: number, wastePercent = 5) => tiles(surfaceM2, cmW, cmH, wastePercent).tiles;
/** Bordures / plinthes : nombre d'éléments pour un linéaire. */
export const linear = (lengthM: number, pieceM: number, wastePercent = 5) => (pieceM > 0 ? Math.ceil((lengthM * (1 + wastePercent / 100)) / pieceM - 1e-9) : 0);
