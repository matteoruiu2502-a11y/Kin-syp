import { escapeHtml, formatDateFr } from './escape';

/**
 * Graphique d'évolution (SVG statique pour le PDF) : une courbe par côté,
 * la norme en pointillés. Palette catégorielle validée (ordre fixe :
 * gauche = bleu, droite = orange) ; textes en encre neutre, jamais dans la
 * couleur de la série ; légende toujours présente + étiquette directe sur
 * le dernier point.
 */
export const CHART_COLORS = {
  left: '#2a78d6',
  right: '#eb6834',
  norm: '#8a8984',
  grid: '#e7e6e2',
  axis: '#b9b8b2',
  text: '#0b0b0b',
  textMuted: '#52514e',
  surface: '#fcfcfb',
} as const;

export interface ChartSeries {
  key: 'left' | 'right';
  label: string;
  points: Array<{ date: string; value: number }>;
}

export interface EvolutionChartInput {
  title: string;
  series: ChartSeries[];
  norm: number | null;
  width?: number;
  height?: number;
}

/** Pas de graduation "rond" donnant au plus 6 intervalles. */
function niceStep(range: number): number {
  for (const step of [5, 10, 15, 20, 30, 45, 60, 90]) {
    if (range / step <= 6) return step;
  }
  return 180;
}

export function evolutionChartSvg({ title, series, norm, width = 340, height = 200 }: EvolutionChartInput): string {
  const margin = { top: 36, right: 64, bottom: 30, left: 36 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  if (norm !== null) values.push(norm);
  const rawMax = Math.max(...values, 10) * 1.05;
  const rawMin = Math.min(...values, 0);
  const step = niceStep(rawMax - rawMin);
  const yMax = Math.ceil(rawMax / step) * step;
  const yMin = Math.floor(rawMin / step) * step;

  const x = (date: string) =>
    margin.left + (dates.length <= 1 ? plotW / 2 : (dates.indexOf(date) / (dates.length - 1)) * plotW);
  const y = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeHtml(title)}" font-family="-apple-system, Helvetica, Arial, sans-serif">`,
  );
  parts.push(`<rect width="${width}" height="${height}" fill="${CHART_COLORS.surface}"/>`);
  parts.push(`<text x="${margin.left}" y="16" font-size="12" font-weight="700" fill="${CHART_COLORS.text}">${escapeHtml(title)}</text>`);

  // Légende (toujours présente pour ≥ 2 séries).
  let lx = margin.left;
  for (const s of series) {
    parts.push(`<rect x="${lx}" y="23" width="10" height="3" rx="1.5" fill="${CHART_COLORS[s.key]}"/>`);
    parts.push(`<text x="${lx + 14}" y="28" font-size="10" fill="${CHART_COLORS.textMuted}">${escapeHtml(s.label)}</text>`);
    lx += 14 + s.label.length * 6 + 12;
  }
  if (norm !== null) {
    parts.push(`<line x1="${lx}" y1="24.5" x2="${lx + 12}" y2="24.5" stroke="${CHART_COLORS.norm}" stroke-width="1.5" stroke-dasharray="3 2"/>`);
    parts.push(`<text x="${lx + 16}" y="28" font-size="10" fill="${CHART_COLORS.textMuted}">Norme</text>`);
  }

  // Grille horizontale discrète + graduations.
  for (let v = yMin; v <= yMax; v += step) {
    const yy = y(v);
    parts.push(`<line x1="${margin.left}" y1="${yy}" x2="${margin.left + plotW}" y2="${yy}" stroke="${v === 0 ? CHART_COLORS.axis : CHART_COLORS.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${margin.left - 6}" y="${yy + 3}" font-size="9" text-anchor="end" fill="${CHART_COLORS.textMuted}">${Math.round(v)}°</text>`);
  }

  // Dates (au plus ~6 étiquettes).
  const every = Math.max(1, Math.ceil(dates.length / 6));
  dates.forEach((d, i) => {
    if (i % every !== 0 && i !== dates.length - 1) return;
    parts.push(`<text x="${x(d)}" y="${height - 10}" font-size="9" text-anchor="middle" fill="${CHART_COLORS.textMuted}">${formatDateFr(d).slice(0, 5)}</text>`);
  });

  if (norm !== null) {
    parts.push(`<line x1="${margin.left}" y1="${y(norm)}" x2="${margin.left + plotW}" y2="${y(norm)}" stroke="${CHART_COLORS.norm}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    parts.push(`<text x="${margin.left + 4}" y="${y(norm) - 4}" font-size="9" fill="${CHART_COLORS.textMuted}">Norme ${norm}°</text>`);
  }

  // Étiquettes directes : décalées si les deux derniers points se chevauchent.
  const lastLabels: Array<{ y: number; text: string; key: 'left' | 'right' }> = [];
  for (const s of series) {
    if (s.points.length === 0) continue;
    const color = CHART_COLORS[s.key];
    const pts = [...s.points].sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length > 1) {
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    for (const p of pts) {
      parts.push(`<circle cx="${x(p.date)}" cy="${y(p.value)}" r="4" fill="${color}" stroke="${CHART_COLORS.surface}" stroke-width="2"/>`);
    }
    const last = pts[pts.length - 1];
    lastLabels.push({ y: y(last.value), text: `${s.label.charAt(0)} ${Math.round(last.value)}°`, key: s.key });
  }
  lastLabels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < lastLabels.length; i++) {
    if (lastLabels[i].y - lastLabels[i - 1].y < 12) lastLabels[i].y = lastLabels[i - 1].y + 12;
  }
  const labelX = margin.left + plotW + 8;
  for (const l of lastLabels) {
    parts.push(`<rect x="${labelX}" y="${l.y - 4}" width="6" height="6" rx="1" fill="${CHART_COLORS[l.key]}"/>`);
    parts.push(`<text x="${labelX + 9}" y="${l.y + 2}" font-size="10" font-weight="700" fill="${CHART_COLORS.text}">${escapeHtml(l.text)}</text>`);
  }

  parts.push('</svg>');
  return parts.join('');
}
