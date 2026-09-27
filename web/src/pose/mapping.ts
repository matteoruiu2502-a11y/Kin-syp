import type { ScreenLandmark } from '@core';

/**
 * Projection d'un repère normalisé de l'image source vers la zone d'affichage
 * (équivalent CSS object-fit: cover), avec miroir optionnel (caméra frontale).
 * Transformation conforme : les angles sont conservés.
 */
export function mapToView(
  landmarks: Array<{ x: number; y: number; visibility?: number }>,
  image: { width: number; height: number },
  view: { width: number; height: number },
  mirrored: boolean,
): ScreenLandmark[] {
  const scale = Math.max(view.width / image.width, view.height / image.height);
  const ox = (view.width - image.width * scale) / 2;
  const oy = (view.height - image.height * scale) / 2;
  return landmarks.map((p) => {
    const nx = mirrored ? 1 - p.x : p.x;
    return { x: nx * image.width * scale + ox, y: p.y * image.height * scale + oy, visibility: p.visibility ?? 1 };
  });
}
