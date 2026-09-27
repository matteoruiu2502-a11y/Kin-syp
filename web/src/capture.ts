import { JOINTS, MIN_MEASURED_RANGE, SKELETON_CONNECTIONS, type JointAnalysis, type ScreenLandmark } from '@core';

/**
 * Capture annotée (squelette + angles) de la zone de mesure, en JPEG 800 px,
 * pour illustrer le bilan. Tout reste dans le navigateur.
 */
export function captureStage(
  media: HTMLCanvasElement | HTMLVideoElement | null,
  view: { width: number; height: number },
  landmarks: ScreenLandmark[] | null,
  analysis: JointAnalysis,
  mirrored: boolean,
): string | null {
  if (!media || view.width === 0) return null;
  const W = 800;
  const k = W / view.width;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.round(view.height * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const srcW = media instanceof HTMLVideoElement ? media.videoWidth : media.width;
  const srcH = media instanceof HTMLVideoElement ? media.videoHeight : media.height;
  if (!srcW || !srcH) return null;
  const scale = Math.max(canvas.width / srcW, canvas.height / srcH);
  ctx.save();
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(media, (canvas.width - srcW * scale) / 2, (canvas.height - srcH * scale) / 2, srcW * scale, srcH * scale);
  ctx.restore();

  if (landmarks) {
    const p = (i: number) => ({ x: landmarks[i].x * k, y: landmarks[i].y * k });
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      if (landmarks[i].visibility < 0.5 || landmarks[j].visibility < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(p(i).x, p(i).y);
      ctx.lineTo(p(j).x, p(j).y);
      ctx.stroke();
    }
    ctx.font = '700 22px Barlow, system-ui, sans-serif';
    for (const def of JOINTS) {
      const m = analysis.joints[def.id];
      if (!m.tracked || m.peak === null || m.min === null || m.peak - m.min < MIN_MEASURED_RANGE) continue;
      const b = p(def.vertex);
      ctx.fillStyle = '#22D3EE';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
      const label = `${def.label} max ${Math.round(m.peak)}°`;
      const w = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(11,18,32,0.85)';
      ctx.fillRect(b.x + 10, b.y - 28, w + 12, 30);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(label, b.x + 16, b.y - 6);
    }
  }
  return canvas.toDataURL('image/jpeg', 0.72);
}
