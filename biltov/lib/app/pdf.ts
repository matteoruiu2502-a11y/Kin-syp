// PDF belges (devis, factures, notes de crédit, pro forma, rapports), dans la langue du client.

import type { jsPDF } from "jspdf";

// jsPDF (~380 Ko) n'est chargé qu'au moment de fabriquer un PDF : l'application démarre plus vite.
async function pdfLib() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  return { jsPDF, autoTable };
}
import { formatBce, legal, mentionsFor, normalizeBce, type VatCode } from "../tax/belgium";
import { dt, fmtDate, LOCALE } from "./docText";
import { epcPayload, epcQrDataUrl } from "./epc";
import { computeTotals, countsInTotal, eur, lineTotal, num } from "./money";
import type { AccountData, Address, Client, Doc, Job, Lang, Photo, PhotoPhase, Report } from "./types";

const M = 15;
const W = 210;
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const addr = (a: Address) => [a.street, `${a.postcode} ${a.city}`.trim()].filter(Boolean);

export function docTitle(doc: Doc, lang: Lang = doc.lang) {
  if (doc.type === "quote") return dt(lang, "quote");
  if (doc.type === "credit") return dt(lang, "credit");
  if (doc.type === "proforma") return dt(lang, "proforma");
  return dt(lang, doc.kind === "deposit" ? "deposit" : doc.kind === "situation" ? "situation" : doc.kind === "final" ? "final" : "invoice");
}

export const docFileName = (doc: Doc, client?: Client) => `${docTitle(doc, "fr").toLowerCase()}-${doc.number ?? "brouillon"}-${client?.name ?? ""}`.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-") + ".pdf";

export const vatLabel = (code: VatCode, lang: Lang) => (code === "reverse" ? dt(lang, "reverse") : code === "franchise" ? dt(lang, "franchise") : code === "exempt" ? dt(lang, "exempt") : `${code} %`);

function header(pdf: jsPDF, data: AccountData, title: string, refs: [string, string][], lang: Lang) {
  const c = data.company;
  const brand = hexToRgb(data.branding.color);
  pdf.setFillColor(...brand).rect(0, 0, W, 4, "F");
  let x = M;
  if (data.branding.logo) {
    const p = pdf.getImageProperties(data.branding.logo);
    const s = Math.min(40 / p.width, 18 / p.height);
    pdf.addImage(data.branding.logo, data.branding.logo.startsWith("data:image/png") ? "PNG" : "JPEG", M, 10, p.width * s, p.height * s);
    x = M + p.width * s + 5;
  }
  pdf.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(13).text(c.name || "—", x, 16);
  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const bce = normalizeBce(c.bce);
  const idLine = c.vatRegime === "normal" && bce ? `${dt(lang, "vatNo")} BE ${formatBce(bce)}` : bce ? `${dt(lang, "bce")} ${formatBce(bce)}` : "";
  pdf.text([...addr(c.address), [c.phone, c.email].filter(Boolean).join(" · "), [idLine, c.rpm].filter(Boolean).join(" · ")].filter(Boolean), x, 21);

  pdf.setFont("helvetica", "bold").setFontSize(17).setTextColor(...brand).text(title, W - M, 17, { align: "right" });
  let y = 23;
  for (const [k, v] of refs) {
    pdf.setFont("helvetica", "bold").setFontSize(8.5);
    const vw = pdf.getTextWidth(v);
    pdf.setTextColor(...INK).text(v, W - M, y, { align: "right" });
    pdf.setFont("helvetica", "normal").setTextColor(...MUTED).text(`${k}  `, W - M - vw, y, { align: "right" });
    y += 4.5;
  }
  return Math.max(y, 38) + 4;
}

function box(pdf: jsPDF, x: number, y: number, w: number, label: string, lines: string[]) {
  const wrapped = lines.filter(Boolean).flatMap((l) => pdf.splitTextToSize(l, w - 8) as string[]);
  const h = 10 + wrapped.length * 4.2;
  pdf.setDrawColor(226, 232, 240).setFillColor(248, 250, 252).roundedRect(x, y, w, h, 2, 2, "FD");
  pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED).text(label.toUpperCase(), x + 4, y + 5.5);
  pdf.setFontSize(9).setTextColor(...INK);
  wrapped.forEach((l, i) => pdf.setFont("helvetica", i === 0 ? "bold" : "normal").text(l, x + 4, y + 10.5 + i * 4.2));
  return h;
}

function footer(pdf: jsPDF, data: AccountData, lang: Lang, watermark?: string) {
  const c = data.company;
  const pages = pdf.getNumberOfPages();
  const bce = normalizeBce(c.bce);
  const line = [c.name, addr(c.address).join(", "), bce ? `${dt(lang, "bce")} ${formatBce(bce)}` : "", c.iban ? `IBAN ${c.iban}` : "", c.bic ? `BIC ${c.bic}` : ""].filter(Boolean).join(" · ");
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(226, 232, 240).line(M, 284, W - M, 284);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize(line, W - 2 * M - 20), M, 288);
    pdf.text(`${i} / ${pages}`, W - M, 288, { align: "right" });
    if (watermark) {
      pdf.saveGraphicsState();
      pdf.setGState(new (pdf as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.1 }) as never);
      pdf.setFont("helvetica", "bold").setFontSize(60).setTextColor(100, 116, 139).text(watermark, W / 2, 175, { align: "center", angle: 35 });
      pdf.restoreGraphicsState();
    }
  }
}

const ensure = (pdf: jsPDF, y: number, need: number) => (y + need > 278 ? (pdf.addPage(), 20) : y);

function paragraphs(pdf: jsPDF, y: number, title: string, items: string[]) {
  if (!items.length) return y;
  pdf.setFont("helvetica", "normal").setFontSize(7.5);
  const text = items.flatMap((i) => pdf.splitTextToSize(`• ${i}`, W - 2 * M) as string[]);
  y = ensure(pdf, y, Math.min(text.length, 12) * 3.4 + 8);
  pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK).text(title.toUpperCase(), M, y);
  pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
  y += 4;
  for (const t of text) {
    y = ensure(pdf, y, 4);
    pdf.text(t, M, y);
    y += 3.4;
  }
  return y + 4;
}

export async function buildDocumentPdf(doc: Doc, data: AccountData, opts: { watermark?: string; source?: Doc | null } = {}): Promise<jsPDF> {
  const { jsPDF, autoTable } = await pdfLib();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const lang = doc.lang;
  const loc = LOCALE[lang];
  const c = data.company;
  const job = data.jobs.find((j) => j.id === doc.jobId) as Job | undefined;
  const client = data.clients.find((x) => x.id === doc.clientId);
  const brand = hexToRgb(data.branding.color);
  const t = computeTotals(doc);

  const refs: [string, string][] = [
    [dt(lang, "number"), doc.number ?? "—"],
    [dt(lang, "date"), fmtDate(doc.issueDate, lang)],
  ];
  if (doc.type === "quote") refs.push([dt(lang, "validUntil"), fmtDate(doc.validUntil, lang)]);
  if (doc.type === "invoice" || doc.type === "proforma") {
    if (doc.workDate && doc.workDate !== doc.issueDate) refs.push([dt(lang, "workDate"), fmtDate(doc.workDate, lang)]);
    refs.push([dt(lang, "dueDate"), fmtDate(doc.dueDate, lang)]);
  }
  if (opts.source?.number) refs.push([dt(lang, "ref"), opts.source.number]);

  let y = header(pdf, data, docTitle(doc), refs, lang);
  const half = (W - 2 * M - 6) / 2;
  const clientLines = client ? [client.name, client.contactName, ...addr(client.billing), client.vatNumber ? `${dt(lang, "vatNo")} ${client.vatNumber}` : ""] : ["—"];
  const site = client?.sites.find((s) => s.id === job?.siteId);
  const siteLines = [job?.name ?? "", ...(site ? addr(site) : job?.siteAddress ? [job.siteAddress] : client ? addr(client.billing) : [])];
  y += Math.max(box(pdf, M, y, half, dt(lang, "client"), clientLines), box(pdf, M + half + 6, y, half, dt(lang, "site"), siteLines)) + 6;

  // Lignes (sections, textes, options)
  const body: (string | { content: string; colSpan?: number; styles?: object })[][] = [];
  for (const l of doc.lines) {
    if (l.kind === "section") body.push([{ content: l.label.toUpperCase(), colSpan: 7, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } }]);
    else if (l.kind === "text") body.push([{ content: l.label, colSpan: 7, styles: { fontStyle: "italic", textColor: MUTED } }]);
    else {
      const opt = l.optional ? ` (${dt(lang, "option")}${l.selected ? "" : ` — ${dt(lang, "notSelected")}`})` : "";
      body.push([l.label + opt, num(l.qty, 3, loc), l.unit, eur(l.unitPrice, loc), l.discountPercent ? `${num(l.discountPercent, 2, loc)} %` : "", vatLabel(l.vat, lang), countsInTotal(l) ? eur(lineTotal(l), loc) : "—"]);
    }
  }
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [[dt(lang, "designation"), dt(lang, "qty"), dt(lang, "unit"), dt(lang, "unitPrice"), dt(lang, "discount"), dt(lang, "vat"), dt(lang, "total")]],
    body,
    styles: { font: "helvetica", fontSize: 8.2, cellPadding: 2, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: brand, textColor: 255, fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", cellWidth: 14 }, 2: { cellWidth: 13 }, 3: { halign: "right", cellWidth: 22 }, 4: { halign: "right", cellWidth: 13 }, 5: { halign: "right", cellWidth: 17 }, 6: { halign: "right", cellWidth: 24 } },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // Récapitulatif TVA par taux + totaux
  y = ensure(pdf, y, 40 + t.vatRows.length * 5);
  const recap = autoTable(pdf, {
    startY: y,
    margin: { left: M, right: W - M - 95 },
    head: [[dt(lang, "vat"), dt(lang, "base"), dt(lang, "vatAmount")]],
    body: t.vatRows.map((r) => [vatLabel(r.code, lang), eur(r.base, loc), eur(r.vat, loc)]),
    styles: { fontSize: 7.8, cellPadding: 1.6, textColor: INK },
    headStyles: { fillColor: [241, 245, 249], textColor: INK },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  void recap;
  const rows: [string, string, boolean?][] = [];
  if (t.discount) rows.push([`${dt(lang, "globalDiscount")} ${num(doc.globalDiscountPercent, 2, loc)} %`, `- ${eur(t.discount, loc)}`]);
  for (const d of doc.deductions) rows.push([d.label, `- ${eur(d.amount, loc)}`]);
  rows.push([dt(lang, "subtotal"), eur(t.htva, loc)], [dt(lang, "vatAmount"), eur(t.vat, loc)], [dt(lang, "totalTvac"), eur(t.tvac, loc), true]);
  if (doc.type === "quote" && doc.depositPercent) rows.push([`${dt(lang, "depositAsked")} (${doc.depositPercent} %)`, eur(t.deposit, loc)]);
  if (t.retention) rows.push([`${dt(lang, "retention")} (${doc.retentionPercent} %)`, `- ${eur(t.retention, loc)}`]);
  if (t.paid) rows.push([dt(lang, "paid"), `- ${eur(t.paid, loc)}`]);
  if (doc.type === "invoice" && (t.retention || t.paid)) rows.push([dt(lang, "toPay"), eur(t.due, loc), true]);
  const tx = W - M - 82;
  rows.forEach(([k, v, strong], i) => {
    const ry = y + 4 + i * 5.6;
    if (strong) {
      pdf.setFillColor(...brand).roundedRect(tx, ry - 4, 82, 6, 1, 1, "F");
      pdf.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(9.5);
    } else pdf.setTextColor(...INK).setFont("helvetica", "normal").setFontSize(8.5);
    pdf.text(k, tx + 3, ry);
    pdf.text(v, W - M - 3, ry, { align: "right" });
  });
  y = Math.max((pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY, y + 4 + rows.length * 5.6) + 6;

  // Paiement : IBAN, communication structurée, QR EPC
  if ((doc.type === "invoice" || doc.type === "proforma") && c.iban && t.due > 0) {
    y = ensure(pdf, y, 34);
    const comm = doc.structuredComm || "";
    const qr = await epcQrDataUrl(epcPayload({ name: c.name, iban: c.iban, bic: c.bic, amount: t.due, communication: comm || doc.number || "" }));
    pdf.setDrawColor(226, 232, 240).roundedRect(M, y, W - 2 * M, 30, 2, 2);
    pdf.addImage(qr, "PNG", M + 2, y + 2, 26, 26);
    pdf.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK).text(dt(lang, "payment"), M + 32, y + 7);
    pdf.setFont("helvetica", "normal").setFontSize(8.5);
    pdf.text([`${dt(lang, "payTo")} ${c.iban}${c.bic ? ` (BIC ${c.bic})` : ""} — ${c.name}`, comm ? `${dt(lang, "communication")} : ${comm}` : "", `${dt(lang, "toPay")} : ${eur(t.due, loc)} — ${dt(lang, "dueDate")} ${fmtDate(doc.dueDate, lang)}`].filter(Boolean), M + 32, y + 13);
    pdf.setFontSize(7).setTextColor(...MUTED).text(dt(lang, "scan"), M + 2, y + 29.5);
    y += 36;
  }

  if (doc.notes) {
    pdf.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...MUTED);
    const n = pdf.splitTextToSize(doc.notes, W - 2 * M) as string[];
    y = ensure(pdf, y, n.length * 4 + 2);
    pdf.text(n, M, y);
    y += n.length * 4 + 3;
  }

  // Conditions et mentions TVA
  const b2c = !client || client.kind === "particulier";
  const conditions: string[] = [];
  if (doc.type === "quote") {
    conditions.push(dt(lang, "validity", { d: fmtDate(doc.validUntil, lang) }));
    if (doc.depositPercent) conditions.push(dt(lang, "depositCond", { p: doc.depositPercent }));
    if (b2c && job?.offPremises) conditions.push(dt(lang, "offPremises"));
  } else if (doc.type === "invoice" && c.iban) {
    conditions.push(dt(lang, "payBy", { d: fmtDate(doc.dueDate, lang), iban: c.iban, c: doc.structuredComm || doc.number || "" }));
    if (!b2c) conditions.push(dt(lang, "lateB2b", { f: legal("b2b.flatIndemnity") }));
  }
  y = paragraphs(pdf, y, dt(lang, "conditions"), conditions);
  y = paragraphs(pdf, y, dt(lang, "mentions"), mentionsFor(doc.lines.filter(countsInTotal).map((l) => l.vat), lang));

  if (doc.type === "quote") {
    y = ensure(pdf, y, 42);
    const bw = 88;
    pdf.setDrawColor(203, 213, 225).roundedRect(W - M - bw, y, bw, 38, 2, 2);
    pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK).text(dt(lang, "agreement"), W - M - bw + 4, y + 5.5);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED).text(dt(lang, "agreementHint"), W - M - bw + 4, y + 9.5);
    if (doc.signature) {
      pdf.addImage(doc.signature.image, "PNG", W - M - bw + 4, y + 13, 50, 16);
      pdf.setFontSize(7.5).setTextColor(...INK).text(`${dt(lang, "signedBy")} ${doc.signature.name} — ${new Date(doc.signature.at).toLocaleString(loc)}`, W - M - bw + 4, y + 35);
    }
    pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK).text(dt(lang, "company"), M, y + 5.5);
    pdf.setFont("helvetica", "normal").setFontSize(8).text([c.owner, c.name].filter(Boolean), M, y + 10.5);
    y += 44;
  }

  // Conditions générales rédigées par l'artisan (facultatives)
  const terms = b2c ? data.settings.terms.b2c : data.settings.terms.b2b;
  if (terms.trim() && doc.type === "quote") {
    pdf.addPage();
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text(dt(lang, "conditions").toUpperCase(), M, 20);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    let ty = 27;
    for (const line of pdf.splitTextToSize(terms, W - 2 * M) as string[]) {
      ty = ensure(pdf, ty, 4);
      pdf.text(line, M, ty);
      ty += 3.4;
    }
  }

  footer(pdf, data, lang, opts.watermark);
  pdf.setProperties({ title: `${docTitle(doc)} ${doc.number ?? ""}`, author: c.name, creator: "Biltov" });
  return pdf;
}

const PHASES: [PhotoPhase, "before" | "during" | "after"][] = [
  ["avant", "before"],
  ["pendant", "during"],
  ["apres", "after"],
];

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

async function photoGrid(pdf: jsPDF, y: number, photos: Photo[], getBlob: (id: string) => Promise<Blob | undefined>, lang: Lang) {
  const colW = (W - 2 * M - 6) / 2;
  for (let i = 0; i < photos.length; i += 2) {
    const pair = photos.slice(i, i + 2);
    const hs = pair.map((p) => Math.min(70, (colW / p.width) * p.height));
    y = ensure(pdf, y, Math.max(...hs) + 10);
    for (let k = 0; k < pair.length; k++) {
      const p = pair[k];
      const b = await getBlob(p.id);
      if (!b) continue;
      const w = Math.min(colW, (hs[k] / p.height) * p.width);
      pdf.addImage(await blobToDataUrl(b), "JPEG", M + k * (colW + 6), y, w, hs[k]);
      pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED).text(`${new Date(p.takenAt).toLocaleString(LOCALE[lang])}${p.caption ? ` — ${p.caption}` : ""}`, M + k * (colW + 6), y + hs[k] + 4, { maxWidth: colW });
    }
    y += Math.max(...hs) + 10;
  }
  return y;
}

export async function buildPhotoReport(job: Job, client: Client | undefined, photos: Photo[], data: AccountData, getBlob: (id: string) => Promise<Blob | undefined>, watermark?: string) {
  const { jsPDF } = await pdfLib();
  const lang = client?.lang ?? data.company.lang;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = header(pdf, data, dt(lang, "photoReport"), [[dt(lang, "site"), job.name], [dt(lang, "date"), fmtDate(new Date().toISOString(), lang)]], lang);
  y += box(pdf, M, y, W - 2 * M, dt(lang, "client"), [client?.name ?? "", job.siteAddress || (client ? addr(client.billing).join(", ") : "")]) + 6;
  for (const [phase, key] of PHASES) {
    const list = photos.filter((p) => p.phase === phase).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    if (!list.length) continue;
    y = ensure(pdf, y, 20);
    pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...hexToRgb(data.branding.color)).text(dt(lang, key), M, y);
    y = await photoGrid(pdf, y + 4, list, getBlob, lang);
  }
  footer(pdf, data, lang, watermark);
  return pdf;
}

/** Bon d'intervention / rapport de chantier signé sur place. */
export async function buildReportPdf(report: Report, job: Job, client: Client | undefined, photos: Photo[], data: AccountData, getBlob: (id: string) => Promise<Blob | undefined>, watermark?: string) {
  const { jsPDF, autoTable } = await pdfLib();
  const lang = client?.lang ?? data.company.lang;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = header(pdf, data, dt(lang, "intervention"), [[dt(lang, "date"), fmtDate(report.date, lang)], [dt(lang, "site"), job.name]], lang);
  y += box(pdf, M, y, W - 2 * M, dt(lang, "client"), [client?.name ?? "", job.siteAddress || (client ? addr(client.billing).join(", ") : "")]) + 6;
  const members = report.memberIds.map((id) => data.members.find((m) => m.id === id)?.name).filter(Boolean).join(", ");
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    body: [
      ...(members ? [["Équipe", members]] : []),
      ["Heures", num(report.hours)],
      ...report.checklist.map((c) => [c.done ? "☑" : "☐", c.label]),
      ...report.materials.map((m) => ["Matériel", `${m.qty} ${m.unit} — ${m.label}`]),
    ],
    styles: { fontSize: 8.5 },
    columnStyles: { 0: { cellWidth: 28, fontStyle: "bold" } },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (report.notes) {
    const n = pdf.splitTextToSize(report.notes, W - 2 * M) as string[];
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK).text(n, M, y);
    y += n.length * 4.5 + 4;
  }
  const pics = photos.filter((p) => report.photoIds.includes(p.id));
  if (pics.length) y = await photoGrid(pdf, y, pics, getBlob, lang);
  if (report.signature) {
    y = ensure(pdf, y, 30);
    pdf.addImage(report.signature.image, "PNG", M, y, 50, 16);
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK).text(`${dt(lang, "signedBy")} ${report.signature.name} — ${new Date(report.signature.at).toLocaleString(LOCALE[lang])}`, M, y + 21);
  }
  footer(pdf, data, lang, watermark);
  return pdf;
}

// ── Rapport d'intempéries ────────────────────────────────────────────────────

const BXL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" };

/** Image quelconque (PNG, JPEG, WebP…) → JPEG utilisable par jsPDF, avec ses dimensions. */
async function toJpeg(blob: Blob, max = 1200): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) });
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return { url: canvas.toDataURL("image/jpeg", 0.82), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  }
}

/**
 * Rapport d'intempéries d'un chantier (ou de tous) sur une période : liste détaillée, heures perdues,
 * preuves jointes avec leur empreinte et miniatures, photos du chantier. Pièce justificative pour un client,
 * un assureur ou un dossier de chômage temporaire (ne remplace pas la déclaration officielle).
 */
export async function buildWeatherReport(
  opts: { days: import("./types").WeatherDay[]; job: Job | null; from: string; to: string; author: string },
  data: AccountData,
  getBlob: (key: string) => Promise<Blob | undefined>,
  watermark?: string,
) {
  const { KIND_LABEL, IMPACT_LABEL, DURATION_LABEL, STATUS_LABEL, displayStatus, delayDays } = await import("./weather");
  const { jsPDF, autoTable } = await pdfLib();
  const lang: Lang = "fr";
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const fr = (iso: string) => fmtDate(iso, lang);
  const { job, days } = opts;
  const client = job ? data.clients.find((c) => c.id === job.clientId) : undefined;
  let y = header(pdf, data, "Rapport d'intempéries", [["Chantier", job ? job.name : "Tous les chantiers"], ["Période", `${fr(opts.from)} – ${fr(opts.to)}`]], lang);
  if (job) y += box(pdf, M, y, W - 2 * M, "Client et adresse du chantier", [client?.name ?? "", job.siteAddress || (client ? addr(client.billing).join(", ") : "")]) + 6;

  const cal = data.settings.planning;
  const hours = days.reduce((s, w) => s + w.hoursLost, 0);
  const delay = days.reduce((s, w) => s + delayDays(w, cal), 0);
  const toJustify = days.filter((w) => displayStatus(w) === "to_justify").length;
  pdf.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
  pdf.text(
    `${days.length} intempérie(s) · ${num(Math.round(hours * 10) / 10)} heure(s) perdue(s) · ${num(Math.round(delay * 10) / 10)} jour(s) de retard imputable(s) à la météo · ${days.length - toJustify} justifiée(s), ${toJustify} à justifier`,
    M,
    y,
    { maxWidth: W - 2 * M },
  );
  y += 8;

  const job_ = (id: string) => data.jobs.find((j) => j.id === id)?.name ?? "?";
  const member = (id: string) => data.members.find((m) => m.id === id)?.name ?? "?";
  const sorted = [...days].sort((a, b) => a.start.localeCompare(b.start));
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Date", "Type", "Durée / impact", "Ouvriers", "H perdues", "Relevés", "Preuves", "Statut"]],
    body: sorted.map((w) => [
      w.end && w.end !== w.start ? `${fr(w.start)}\n→ ${fr(w.end)}` : fr(w.start),
      `${KIND_LABEL[w.kind]}${job ? "" : `\n${w.jobIds.map(job_).join(", ")}`}`,
      `${w.duration === "hours" ? `${w.fromTime}–${w.toTime}` : DURATION_LABEL[w.duration]}\n${IMPACT_LABEL[w.impact]}`,
      w.memberIds.map(member).join(", ") || "—",
      num(w.hoursLost),
      [
        w.measures.rainMm !== null ? `${num(w.measures.rainMm)} mm` : "",
        w.measures.tMin !== null || w.measures.tMax !== null ? `${w.measures.tMin ?? "?"} / ${w.measures.tMax ?? "?"} °C` : "",
        w.measures.windKmh !== null ? `${w.measures.windKmh} km/h` : "",
        w.measures.source === "open-meteo" ? "(Open-Meteo, indicatif)" : "",
      ]
        .filter(Boolean)
        .join("\n") || "—",
      String(w.proofs.length),
      STATUS_LABEL[displayStatus(w)],
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, valign: "top" },
    headStyles: { fillColor: hexToRgb(data.branding.color), fontSize: 7.5 },
    columnStyles: { 4: { halign: "right" }, 6: { halign: "center" } },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Détail des preuves : empreinte, source, miniatures
  for (const w of sorted) {
    if (!w.proofs.length && !w.photoIds.length && !w.comment) continue;
    y = ensure(pdf, y, 22);
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(...hexToRgb(data.branding.color)).text(`${fr(w.start)}${w.end !== w.start ? ` → ${fr(w.end)}` : ""} — ${KIND_LABEL[w.kind]}`, M, y);
    y += 5;
    pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK);
    if (w.comment) {
      const n = pdf.splitTextToSize(w.comment, W - 2 * M) as string[];
      y = ensure(pdf, y, n.length * 3.8 + 2);
      pdf.text(n, M, y);
      y += n.length * 3.8 + 2;
    }
    for (const p of w.proofs) {
      const lines = [
        `${p.kind === "link" ? "Lien" : "Fichier"} : ${p.name}`,
        p.url ? `Source : ${p.url}${p.consultedAt ? ` (consultée le ${new Date(p.consultedAt).toLocaleString("fr-BE", BXL)})` : ""}` : "",
        `Ajouté le ${new Date(p.addedAt).toLocaleString("fr-BE", BXL)} par ${p.addedBy}`,
        p.sha256 ? `Empreinte SHA-256 : ${p.sha256}` : "",
      ].filter(Boolean);
      const wrapped = lines.flatMap((l) => pdf.splitTextToSize(l, W - 2 * M - 4) as string[]);
      const blob = p.kind === "file" && p.mime.startsWith("image/") ? await getBlob(`proof:${p.id}`) : undefined;
      const img = blob ? await toJpeg(blob) : null;
      const ih = img ? Math.min(60, ((W - 2 * M) / 2 / img.w) * img.h) : 0;
      y = ensure(pdf, y, wrapped.length * 3.6 + ih + 6);
      pdf.setFontSize(7.5).setTextColor(...MUTED).text(wrapped, M + 2, y);
      y += wrapped.length * 3.6 + 1;
      if (img) {
        pdf.addImage(img.url, "JPEG", M + 2, y, (ih / img.h) * img.w, ih);
        y += ih + 3;
      }
      y += 2;
    }
    const pics = data.photos.filter((ph) => w.photoIds.includes(ph.id));
    if (pics.length) y = await photoGrid(pdf, y, pics, (id) => getBlob(`photo:${id}`), lang);
    y += 3;
  }

  y = ensure(pdf, y, 26);
  pdf.setDrawColor(226, 232, 240).line(M, y, W - M, y);
  y += 5;
  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK);
  pdf.text(`Établi par ${opts.author} le ${new Date().toLocaleString("fr-BE", BXL)}.`, M, y);
  pdf.setFontSize(7).setTextColor(...MUTED);
  pdf.text(
    pdf.splitTextToSize(
      "Les relevés « Open-Meteo » sont indicatifs ; la preuve officielle est le bulletin ou relevé de l'IRM joint. L'empreinte SHA-256 permet de vérifier qu'un fichier joint n'a pas été modifié depuis son ajout. Ce rapport est une pièce justificative : il ne remplace pas la déclaration de chômage temporaire auprès de l'ONEM.",
      W - 2 * M,
    ),
    M,
    y + 5,
  );
  footer(pdf, data, lang, watermark);
  return pdf;
}
