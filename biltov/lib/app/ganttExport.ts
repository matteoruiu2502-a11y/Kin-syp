// Export du Gantt en PDF (A3 paysage, vectoriel) et en image PNG.
// Un seul dessin, écrit pour une « surface » abstraite en millimètres : jsPDF pour le PDF,
// un canvas pour l'image. Fond blanc et couleurs fixes (impression), quel que soit le thème de l'écran.

import type { AccountData, Job, Task } from "./types";
import type { Conflict, JobState, WeekLoad } from "./gantt";
import { JOB_STATE_LABEL, LEAVE, jobProgress, jobState } from "./gantt";
import { dayOff, daysBetween, eachDay, plusDays, weekday } from "./workdays";
import { coversDay } from "./weather";

type RGB = [number, number, number];
type TextOpts = { size: number; bold?: boolean; color?: RGB; align?: "left" | "right" | "center" };
interface Surface {
  rect(x: number, y: number, w: number, h: number, fill: RGB | null, stroke?: RGB | null): void;
  line(x1: number, y1: number, x2: number, y2: number, color: RGB, width?: number): void;
  text(s: string, x: number, y: number, o: TextOpts): void;
  measure(s: string, size: number, bold?: boolean): number;
  image(dataUrl: string, x: number, y: number, w: number, h: number): void;
}

const INK: RGB = [15, 23, 42];
const MUTED: RGB = [71, 85, 105];
const LINE: RGB = [226, 232, 240];
export const STATE_RGB: Record<JobState, RGB> = { upcoming: [148, 163, 184], ongoing: [29, 78, 216], risk: [234, 88, 12], late: [220, 38, 38], done: [22, 163, 74] };
const WEEKEND: RGB = [241, 245, 249];
const HOLIDAY: RGB = [226, 232, 240];
const LEAVE_RGB: RGB = [219, 234, 254];
const WEATHER: RGB = [191, 219, 254];
const CONFLICT: RGB = [220, 38, 38];
const BRAND: RGB = [29, 78, 216];

const fr = (iso: string) => iso.split("-").reverse().join("/");

export type GanttRow = { label: string; sub: string; start: string; end: string; state: JobState | null; progress: number | null; level: 0 | 1; kind: "job" | "phase" | "task" | "milestone"; conflicts: string[]; weather: string[]; baseline?: { start: string; end: string } | null; critical?: boolean };

export type GanttModel = {
  title: string;
  subtitle: string;
  company: string;
  logo: string | null;
  from: string;
  to: string;
  today: string;
  rows: GanttRow[];
  load?: WeekLoad[];
  notes: string[]; // conflits, écarts… listés sous le graphique
  cal: AccountData["settings"]["planning"];
  author: string;
  columns: "full" | "client"; // version client : sans colonne « état interne »
};

const fit = (s: Surface, text: string, w: number, size: number, bold = false) => {
  if (s.measure(text, size, bold) <= w) return text;
  let t = text;
  while (t.length > 1 && s.measure(`${t}…`, size, bold) > w) t = t.slice(0, -1);
  return `${t}…`;
};

/** Dessine une page (lignes [a, b[) ; renvoie la hauteur utilisée. */
function drawPage(s: Surface, m: GanttModel, W: number, H: number, rows: GanttRow[], page: number, pages: number, withLoad: boolean) {
  const M = 10;
  s.rect(0, 0, W, H, [255, 255, 255]);
  // en-tête
  let x0 = M;
  if (m.logo) {
    try {
      s.image(m.logo, M, 7, 22, 11);
      x0 = M + 25;
    } catch {
      /* logo illisible : ignoré */
    }
  }
  s.text(m.company, x0, 11, { size: 11, bold: true, color: INK });
  s.text(m.subtitle, x0, 16.5, { size: 8, color: MUTED });
  s.text(m.title, W - M, 12, { size: 15, bold: true, color: BRAND, align: "right" });
  s.text(`Période : ${fr(m.from)} – ${fr(m.to)}`, W - M, 17, { size: 8, color: MUTED, align: "right" });
  s.line(M, 21, W - M, 21, LINE, 0.3);

  // colonnes
  const cols = m.columns === "client" ? [{ k: "label", w: 70 }, { k: "start", w: 20 }, { k: "end", w: 20 }] : [{ k: "label", w: 64 }, { k: "sub", w: 38 }, { k: "start", w: 19 }, { k: "end", w: 19 }, { k: "state", w: 20 }];
  const tableW = cols.reduce((a, c) => a + c.w, 0);
  const gx = M + tableW;
  const gw = W - M - gx;
  const days = Math.max(1, daysBetween(m.from, m.to) + 1);
  const pd = gw / days;
  const X = (day: string) => gx + daysBetween(m.from, day) * pd;
  const top = 24;
  const headH = 10;
  const loadH = withLoad && m.load?.length ? 16 : 0;
  // peu de lignes : lignes plus hautes pour remplir la page (lisibilité à l'impression)
  const room = H - top - headH - loadH - 30 - Math.min(m.notes.length, 8) * 4;
  const rowH = Math.min(11, Math.max(6.4, room / Math.max(rows.length, 1)));
  const bodyH = rows.length * rowH;

  // en-tête de tableau et de frise
  let cx = M;
  const heads: Record<string, string> = { label: m.columns === "client" ? "Étape" : "Chantier / tâche", sub: "Client", start: "Début", end: "Fin", state: "État" };
  for (const c of cols) {
    s.text(heads[c.k], cx + 1, top + 7, { size: 7, bold: true, color: MUTED });
    cx += c.w;
  }
  const all = eachDay(m.from, m.to);
  for (const d of all) {
    if (d === m.from || d.endsWith("-01")) {
      s.line(X(d), top, X(d), top + headH + bodyH, LINE, 0.2);
      const label = new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-BE", { month: pd * 30 > 22 ? "long" : "short", year: "2-digit" });
      if (pd * 30 > 8) s.text(label, X(d) + 1, top + 3.6, { size: 6.5, bold: true, color: INK });
    }
    if (pd >= 1.4 && weekday(d) === 0) s.text(d.slice(8), X(d) + 0.4, top + 8, { size: 5.5, color: MUTED });
  }
  // fond : week-ends, fériés, congés
  for (const d of all) {
    const off = dayOff(d, m.cal);
    if (!off || (off.kind === "weekend" && pd < 0.5)) continue;
    s.rect(X(d), top + headH, Math.max(pd, 0.2), bodyH, off.kind === "weekend" ? WEEKEND : off.kind === "holiday" ? HOLIDAY : LEAVE_RGB);
  }
  s.line(M, top + headH, W - M, top + headH, LINE, 0.3);

  rows.forEach((r, i) => {
    const y = top + headH + i * rowH;
    if (r.level === 0 && i > 0) s.line(M, y, W - M, y, LINE, 0.15);
    // intempéries de la ligne
    for (const d of r.weather) if (d >= m.from && d <= m.to) s.rect(X(d), y + 0.3, Math.max(pd, 0.4), rowH - 0.6, WEATHER);
    let tx = M;
    for (const c of cols) {
      const val = c.k === "label" ? r.label : c.k === "sub" ? r.sub : c.k === "start" ? fr(r.start) : c.k === "end" ? (r.kind === "milestone" ? "" : fr(r.end)) : r.state ? JOB_STATE_LABEL[r.state] : "";
      const indent = c.k === "label" ? r.level * 3 : 0;
      s.text(fit(s, val, c.w - 2 - indent, 6.8, r.level === 0 && c.k === "label"), tx + 1 + indent, y + rowH / 2 + 1.2, { size: 6.8, bold: r.level === 0 && c.k === "label", color: c.k === "state" && r.state ? STATE_RGB[r.state] : INK });
      tx += c.w;
    }
    const color = r.state ? STATE_RGB[r.state] : r.kind === "phase" ? [100, 116, 139] as RGB : BRAND;
    if (r.baseline && r.baseline.start && r.baseline.end) {
      s.rect(X(r.baseline.start), y + rowH / 2 + 1.4, Math.max((daysBetween(r.baseline.start, r.baseline.end) + 1) * pd, 0.6), 1, [148, 163, 184]);
    }
    if (r.kind === "milestone") {
      const mx = X(r.start) + pd / 2;
      s.rect(mx - 1.3, y + rowH / 2 - 1.3, 2.6, 2.6, INK);
    } else {
      const bx = X(r.start < m.from ? m.from : r.start);
      const bw = Math.max((daysBetween(r.start < m.from ? m.from : r.start, r.end > m.to ? m.to : r.end) + 1) * pd, 0.6);
      const bh = r.level === 0 ? 3.6 : 2.6;
      const by = y + (rowH - bh) / 2 - (r.baseline ? 0.6 : 0);
      s.rect(bx, by, bw, bh, color, r.critical ? CONFLICT : null);
      if (r.progress !== null && r.progress > 0) s.rect(bx, by + bh - 0.9, (bw * r.progress) / 100, 0.9, INK);
      if (r.progress !== null && bw > 14) s.text(`${r.progress} %`, bx + bw + 1, y + rowH / 2 + 1.1, { size: 5.8, color: MUTED });
    }
    for (const d of r.conflicts) if (d >= m.from && d <= m.to) s.rect(X(d), y + rowH - 1.1, Math.max(pd, 0.6), 0.8, CONFLICT);
  });
  // aujourd'hui
  if (m.today >= m.from && m.today <= m.to) s.line(X(m.today) + pd / 2, top, X(m.today) + pd / 2, top + headH + bodyH, BRAND, 0.5);

  // charge de travail
  let y = top + headH + bodyH + 2;
  if (loadH) {
    s.text("Charge : ouvriers nécessaires / disponibles", M, y + 6, { size: 6.8, bold: true, color: INK });
    const max = Math.max(1, ...m.load!.map((l) => Math.max(l.needed, l.available)));
    for (const l of m.load!) {
      const wk = l.week < m.from ? m.from : l.week;
      if (wk > m.to) continue;
      const lx = X(wk);
      const lw = Math.max(5 * pd - 0.4, 0.4);
      const nh = (l.needed / max) * (loadH - 4);
      const ah = (l.available / max) * (loadH - 4);
      s.rect(lx, y + loadH - nh, lw, nh, l.needed > l.available ? CONFLICT : [147, 197, 253]);
      s.line(lx, y + loadH - ah, lx + lw, y + loadH - ah, MUTED, 0.3);
      if (lw > 7) s.text(`${l.needed}/${l.available}`, lx + lw / 2, y + loadH - nh - 0.8, { size: 5, color: MUTED, align: "center" });
    }
    y += loadH + 3;
  }

  // légende + pied
  const legend: [RGB, string][] = [
    [STATE_RGB.upcoming, "À venir"],
    [STATE_RGB.ongoing, "En cours"],
    [STATE_RGB.risk, "À risque"],
    [STATE_RGB.late, "En retard"],
    [STATE_RGB.done, "Terminé"],
    [WEEKEND, "Week-end"],
    [HOLIDAY, "Jour férié"],
    [LEAVE_RGB, "Congé du bâtiment"],
    [WEATHER, "Intempérie"],
    [CONFLICT, "Conflit / chemin critique"],
  ];
  let lx = M;
  const ly = H - 12;
  for (const [c, label] of m.columns === "client" ? legend.filter(([, l]) => !l.startsWith("Conflit")) : legend) {
    s.rect(lx, ly - 2.4, 4, 2.6, c, LINE);
    s.text(label, lx + 5, ly, { size: 6.5, color: MUTED });
    lx += 7 + s.measure(label, 6.5);
  }
  s.text(`Établi par ${m.author} le ${new Date().toLocaleString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" })}`, M, H - 6, { size: 6.5, color: MUTED });
  s.text(`${page} / ${pages}`, W - M, H - 6, { size: 6.5, color: MUTED, align: "right" });
  return y;
}

function drawNotes(s: Surface, m: GanttModel, W: number, y: number, H: number) {
  if (!m.notes.length) return;
  s.text(m.columns === "client" ? "Remarques" : "À surveiller", 10, y + 4, { size: 8, bold: true, color: INK });
  let yy = y + 9;
  for (const n of m.notes) {
    if (yy > H - 16) break;
    s.text(fit(s, `• ${n}`, W - 20, 7), 10, yy, { size: 7, color: MUTED });
    yy += 4;
  }
}

// ── Construction du modèle ──────────────────────────────────────────────────

export function globalModel(o: { data: AccountData; jobs: Job[]; from: string; to: string; today: string; conflicts: Conflict[]; load: WeekLoad[] }): GanttModel {
  const { data } = o;
  const name = (id: string) => (id === LEAVE ? "Congé" : (data.jobs.find((j) => j.id === id)?.name ?? "?"));
  const res = (r: string) => (r.startsWith("m:") ? data.members.find((m) => m.id === r.slice(2))?.name : data.vehicles.find((v) => v.id === r.slice(2))?.plate) ?? "?";
  const weatherDays = (jobId: string) => data.weatherDays.filter((w) => w.jobIds.includes(jobId)).flatMap((w) => eachDay(w.start, w.end || w.start));
  return {
    title: "Planning des chantiers",
    subtitle: `${o.jobs.length} chantier(s) · ${o.conflicts.length} conflit(s)`,
    company: data.company.name || "Biltov",
    logo: data.branding.logo,
    from: o.from,
    to: o.to,
    today: o.today,
    rows: o.jobs.map((j) => ({
      label: j.name,
      sub: data.clients.find((c) => c.id === j.clientId)?.name ?? "",
      start: j.startDate,
      end: j.endDate,
      state: jobState(data, j, o.today),
      progress: jobProgress(data, j),
      level: 0,
      kind: "job",
      conflicts: [...new Set(o.conflicts.filter((c) => c.jobIds.includes(j.id)).flatMap((c) => c.days))],
      weather: weatherDays(j.id),
    })),
    load: o.load.filter((l) => l.week >= plusDays(o.from, -6) && l.week <= o.to),
    notes: o.conflicts.map((c) => `Conflit : ${res(c.resource)} ${c.from === c.to ? `le ${fr(c.from)}` : `du ${fr(c.from)} au ${fr(c.to)}`} — ${c.jobIds.map(name).join(" / ")}`),
    cal: data.settings.planning,
    author: data.company.owner || data.company.name,
    columns: "full",
  };
}

/** Lignes d'un chantier : phases et tâches (avec prévu, chemin critique, conflits, intempéries). */
export function jobRows(data: AccountData, job: Job, tasks: Task[], opts: { critical?: Set<string>; conflictDays?: (t: Task) => string[]; client?: boolean }): GanttRow[] {
  const weather = data.weatherDays.filter((w) => w.jobIds.includes(job.id));
  return tasks.map((t) => ({
    label: t.name,
    sub: t.subcontractorId ? (data.suppliers.find((s) => s.id === t.subcontractorId)?.name ?? "Sous-traitant") : data.members.find((m) => m.id === t.ownerId)?.name ?? "",
    start: t.start,
    end: t.end,
    state: null,
    progress: t.kind === "milestone" ? null : t.progress,
    level: t.kind === "phase" ? 0 : 1,
    kind: t.kind,
    conflicts: opts.client ? [] : (opts.conflictDays?.(t) ?? []),
    weather: eachDay(t.start, t.end).filter((d) => weather.some((w) => coversDay(w, d))),
    baseline: opts.client ? null : t.baseline,
    critical: !opts.client && !!opts.critical?.has(t.id),
  }));
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

const A3 = { w: 420, h: 297 };

async function pdfSurface() {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a3", orientation: "landscape" });
  const s: Surface = {
    rect: (x, y, w, h, fill, stroke) => {
      if (fill) pdf.setFillColor(...fill);
      if (stroke) pdf.setDrawColor(...stroke).setLineWidth(0.2);
      pdf.rect(x, y, w, h, fill && stroke ? "FD" : fill ? "F" : "S");
    },
    line: (x1, y1, x2, y2, c, w = 0.2) => void pdf.setDrawColor(...c).setLineWidth(w).line(x1, y1, x2, y2),
    text: (t, x, y, o) => void pdf.setFont("helvetica", o.bold ? "bold" : "normal").setFontSize(o.size).setTextColor(...(o.color ?? INK)).text(t, x, y, { align: o.align ?? "left" }),
    measure: (t, size, bold) => pdf.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).getTextWidth(t),
    image: (url, x, y, w, h) => {
      const p = pdf.getImageProperties(url);
      const k = Math.min(w / p.width, h / p.height);
      pdf.addImage(url, url.startsWith("data:image/png") ? "PNG" : "JPEG", x, y, p.width * k, p.height * k);
    },
  };
  return { pdf, s };
}

function canvasSurface(ctx: CanvasRenderingContext2D, k: number) {
  const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const font = (size: number, bold?: boolean) => `${bold ? "bold " : ""}${size * 0.3528 * k}px Helvetica, Arial, sans-serif`;
  const s: Surface = {
    rect: (x, y, w, h, fill, stroke) => {
      if (fill) {
        ctx.fillStyle = rgb(fill);
        ctx.fillRect(x * k, y * k, w * k, h * k);
      }
      if (stroke) {
        ctx.strokeStyle = rgb(stroke);
        ctx.lineWidth = 0.2 * k;
        ctx.strokeRect(x * k, y * k, w * k, h * k);
      }
    },
    line: (x1, y1, x2, y2, c, w = 0.2) => {
      ctx.strokeStyle = rgb(c);
      ctx.lineWidth = w * k;
      ctx.beginPath();
      ctx.moveTo(x1 * k, y1 * k);
      ctx.lineTo(x2 * k, y2 * k);
      ctx.stroke();
    },
    text: (t, x, y, o) => {
      ctx.font = font(o.size, o.bold);
      ctx.fillStyle = rgb(o.color ?? INK);
      ctx.textAlign = o.align ?? "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t, x * k, y * k);
    },
    measure: (t, size, bold) => {
      ctx.font = font(size, bold);
      return ctx.measureText(t).width / k;
    },
    image: () => {}, // logo dessiné à part (chargement asynchrone)
  };
  return s;
}

const fileSafe = (s: string) => s.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();

/** Exporte un modèle : PDF A3 paysage (paginé) ou image PNG (une seule image, toute la hauteur). */
export async function exportModel(kind: "pdf" | "png", m: GanttModel, fileBase: string) {
  const perPage = 30;
  if (kind === "pdf") {
    const { pdf, s } = await pdfSurface();
    const pages = Math.max(1, Math.ceil(m.rows.length / perPage));
    for (let p = 0; p < pages; p++) {
      if (p) pdf.addPage("a3", "landscape");
      const y = drawPage(s, m, A3.w, A3.h, m.rows.slice(p * perPage, (p + 1) * perPage), p + 1, pages + (m.notes.length > 8 ? 0 : 0), p === pages - 1);
      if (p === pages - 1) drawNotes(s, m, A3.w, y, A3.h);
    }
    pdf.save(`${fileSafe(fileBase)}.pdf`);
    return;
  }
  const k = 6; // px par mm
  const h = Math.max(A3.h, 24 + 10 + m.rows.length * 6.4 + 22 + Math.min(m.notes.length, 20) * 4 + 30);
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(A3.w * k), height: Math.round(h * k) });
  const ctx = canvas.getContext("2d")!;
  const s = canvasSurface(ctx, k);
  const y = drawPage(s, m, A3.w, h, m.rows, 1, 1, true);
  drawNotes(s, m, A3.w, y, h);
  if (m.logo) {
    try {
      const img = await createImageBitmap(await (await fetch(m.logo)).blob());
      const r = Math.min((22 * k) / img.width, (11 * k) / img.height);
      ctx.drawImage(img, 10 * k, 7 * k, img.width * r, img.height * r);
    } catch {
      /* logo illisible : ignoré */
    }
  }
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const { downloadBlob } = await import("./send");
  downloadBlob(blob, `${fileSafe(fileBase)}.png`);
}

export async function exportGlobalGantt(kind: "pdf" | "png", o: Parameters<typeof globalModel>[0]) {
  const m = globalModel(o);
  await exportModel(kind, m, `planning-chantiers-${o.from}_${o.to}`);
}
