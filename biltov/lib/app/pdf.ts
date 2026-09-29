// Génération des PDF (devis, factures, avoirs, rapport photo) côté navigateur, avec jsPDF.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { buildMentions, companyLegalLine, fmtDate } from "./legal";
import { computeTotals, eur, lineTotal, num } from "./money";
import type { AccountData, Doc, Job, Photo, PhotoPhase } from "./types";

const M = 15; // marge (mm)
const W = 210;
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function docTitle(doc: Doc) {
  if (doc.type === "quote") return "DEVIS";
  if (doc.type === "credit") return "AVOIR";
  return doc.kind === "deposit" ? "FACTURE D'ACOMPTE" : doc.kind === "balance" ? "FACTURE DE SOLDE" : "FACTURE";
}

export const docFileName = (doc: Doc, job: Job) =>
  `${docTitle(doc).toLowerCase().replace(/[^a-z]+/g, "-")}-${doc.number ?? "brouillon"}-${job.client}`.replace(/[^\w-]+/g, "-").replace(/-+/g, "-") + ".pdf";

function imageFormat(dataUrl: string) {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

/** En-tête : logo + émetteur à gauche, titre et références à droite. Renvoie la hauteur utilisée. */
function header(pdf: jsPDF, data: AccountData, title: string, refs: [string, string][]) {
  const c = data.company;
  const brand = hexToRgb(data.branding.color);
  pdf.setFillColor(...brand);
  pdf.rect(0, 0, W, 4, "F");

  let x = M;
  if (data.branding.logo) {
    const props = pdf.getImageProperties(data.branding.logo);
    const scale = Math.min(40 / props.width, 18 / props.height);
    const w = props.width * scale;
    pdf.addImage(data.branding.logo, imageFormat(data.branding.logo), M, 10, w, props.height * scale);
    x = M + w + 5;
  }
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold").setFontSize(13).text(c.name || "—", x, 16);
  pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  const lines = [c.address, `${c.postcode} ${c.city}`.trim(), [c.phone, c.email].filter(Boolean).join(" · ")].filter(Boolean);
  pdf.text(lines, x, 21);

  pdf.setFont("helvetica", "bold").setFontSize(18).setTextColor(...brand);
  pdf.text(title, W - M, 17, { align: "right" });
  pdf.setFontSize(8.5).setTextColor(...INK);
  let y = 23;
  for (const [k, v] of refs) {
    pdf.setFont("helvetica", "bold");
    const vw = pdf.getTextWidth(v);
    pdf.setTextColor(...INK).text(v, W - M, y, { align: "right" });
    pdf.setFont("helvetica", "normal").setTextColor(...MUTED).text(`${k}  `, W - M - vw, y, { align: "right" });
    y += 4.5;
  }
  return Math.max(y, 36) + 4;
}

function box(pdf: jsPDF, x: number, y: number, w: number, label: string, lines: string[]) {
  const wrapped = lines.filter(Boolean).flatMap((l) => pdf.splitTextToSize(l, w - 8) as string[]);
  const h = 10 + wrapped.length * 4.2;
  pdf.setDrawColor(226, 232, 240).setFillColor(248, 250, 252).roundedRect(x, y, w, h, 2, 2, "FD");
  pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...MUTED).text(label.toUpperCase(), x + 4, y + 5.5);
  pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK);
  wrapped.forEach((l, i) => {
    if (i === 0) pdf.setFont("helvetica", "bold");
    pdf.text(l, x + 4, y + 10.5 + i * 4.2);
    if (i === 0) pdf.setFont("helvetica", "normal");
  });
  return h;
}

function footer(pdf: jsPDF, data: AccountData) {
  const pages = pdf.getNumberOfPages();
  const legal = companyLegalLine(data.company);
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(226, 232, 240).line(M, 284, W - M, 284);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize(`${data.company.name} — ${legal}`, W - 2 * M - 20), M, 288);
    pdf.text(`${i} / ${pages}`, W - M, 288, { align: "right" });
  }
}

function ensureSpace(pdf: jsPDF, y: number, needed: number) {
  if (y + needed > 280) {
    pdf.addPage();
    return 20;
  }
  return y;
}

/** Devis, facture ou avoir conforme, prêt à envoyer. */
export function buildDocumentPdf(doc: Doc, job: Job, data: AccountData, source?: Doc | null): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const c = data.company;
  const brand = hexToRgb(data.branding.color);
  const vatApplies = c.vatMode === "normal" && !job.reverseCharge;
  const totals = computeTotals(doc, vatApplies);
  const usesReducedVat = vatApplies && doc.lines.some((l) => l.vat === 10 || l.vat === 5.5);

  const refs: [string, string][] = [["N°", doc.number ?? "BROUILLON"], ["Date", fmtDate(doc.issueDate)]];
  if (doc.type === "quote") refs.push(["Valable jusqu'au", fmtDate(doc.validUntil)]);
  if (doc.type === "invoice") {
    refs.push(["Date d'exécution", fmtDate(doc.workDate)], ["Échéance", fmtDate(doc.dueDate)]);
    if (source?.number) refs.push(["Devis", source.number]);
  }
  if (doc.type === "credit" && source?.number) refs.push(["Facture annulée", source.number]);

  let y = header(pdf, data, docTitle(doc), refs);

  // Client et chantier
  const half = (W - 2 * M - 6) / 2;
  const clientLines = [
    job.client,
    job.clientAddress,
    [job.clientEmail, job.clientPhone].filter(Boolean).join(" · "),
    job.clientType === "professionnel" && job.clientSiren ? `SIREN ${job.clientSiren}` : "",
  ];
  const siteLines = [job.name, job.siteAddress || job.clientAddress, job.startDate ? `Début prévu : ${fmtDate(job.startDate)}` : "", job.duration ? `Durée estimée : ${job.duration}` : ""];
  const h1 = box(pdf, M, y, half, "Client", clientLines);
  const h2 = box(pdf, M + half + 6, y, half, "Chantier / lieu d'exécution", siteLines);
  y += Math.max(h1, h2) + 6;

  // Lignes
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [["Désignation", "Qté", "Unité", "PU HT", ...(vatApplies ? ["TVA"] : []), "Total HT"]],
    body: doc.lines.map((l) => [l.label, num(l.qty), l.unit, eur(l.unitPrice), ...(vatApplies ? [`${num(l.vat, 1)} %`] : []), eur(lineTotal(l))]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.2, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: brand, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: vatApplies
      ? { 1: { halign: "right", cellWidth: 14 }, 2: { cellWidth: 16 }, 3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 15 }, 5: { halign: "right", cellWidth: 26 } }
      : { 1: { halign: "right", cellWidth: 14 }, 2: { cellWidth: 16 }, 3: { halign: "right", cellWidth: 26 }, 4: { halign: "right", cellWidth: 28 } },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Totaux
  const rows: [string, string, boolean?][] = [["Total HT", eur(totals.ht)]];
  if (vatApplies) for (const v of totals.vatByRate) rows.push([`TVA ${num(v.rate, 1)} % sur ${eur(v.base)}`, eur(v.vat)]);
  else rows.push([c.vatMode === "franchise" ? "TVA non applicable" : "TVA autoliquidée", eur(0)]);
  rows.push([doc.type === "credit" ? "Total TTC à déduire" : "Total TTC", eur(totals.ttc), true]);
  if (doc.type === "quote" && doc.depositPercent > 0) rows.push([`Acompte (${doc.depositPercent} %)`, eur(totals.deposit)]);
  if (doc.type === "invoice" && doc.paidBefore > 0) {
    rows.push(["Acomptes déjà réglés", `- ${eur(doc.paidBefore)}`]);
    rows.push(["Net à payer", eur(totals.due), true]);
  }
  if (doc.status === "paid" && doc.paidAt) rows.push([`Réglé le ${fmtDate(doc.paidAt)}${doc.paymentMethod ? ` (${doc.paymentMethod})` : ""}`, "", false]);

  y = ensureSpace(pdf, y, rows.length * 6 + 6);
  const tx = W - M - 80;
  rows.forEach(([k, v, strong], i) => {
    const ry = y + i * 6;
    if (strong) {
      pdf.setFillColor(...brand).roundedRect(tx, ry - 4.2, 80, 6.4, 1.2, 1.2, "F");
      pdf.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(10);
    } else pdf.setTextColor(...INK).setFont("helvetica", "normal").setFontSize(9);
    pdf.text(k, tx + 3, ry);
    pdf.text(v, W - M - 3, ry, { align: "right" });
  });
  y += rows.length * 6 + 4;

  if (doc.notes) {
    pdf.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...MUTED);
    const n = pdf.splitTextToSize(doc.notes, W - 2 * M) as string[];
    y = ensureSpace(pdf, y, n.length * 4 + 2);
    pdf.text(n, M, y);
    y += n.length * 4 + 3;
  }

  // Conditions, règlement et mentions légales
  const mentions = buildMentions(doc, job, c, { depositPercent: doc.depositPercent, paymentTermsDays: data.settings.paymentTermsDays, freeQuote: data.settings.freeQuote, usesReducedVat });
  const payment = doc.type !== "credit" && c.iban ? [`Règlement par virement : IBAN ${c.iban}${c.bic ? ` · BIC ${c.bic}` : ""} — titulaire ${c.name}. Référence à indiquer : ${doc.number ?? ""}.`] : [];
  const blocks: [string, string[]][] = [
    ["Conditions", [...mentions.conditions, ...payment]],
    ["Mentions légales", mentions.legal],
  ];
  for (const [title, items] of blocks) {
    if (!items.length) continue;
    pdf.setFont("helvetica", "normal").setFontSize(7.5);
    const text = items.flatMap((i) => pdf.splitTextToSize(`• ${i}`, W - 2 * M) as string[]);
    y = ensureSpace(pdf, y, text.length * 3.4 + 8);
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK).text(title.toUpperCase(), M, y);
    pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED).text(text, M, y + 4);
    y += text.length * 3.4 + 7;
  }

  // Bon pour accord (devis)
  if (doc.type === "quote") {
    y = ensureSpace(pdf, y, 42);
    const bw = 88;
    pdf.setDrawColor(203, 213, 225).roundedRect(W - M - bw, y, bw, 38, 2, 2);
    pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK).text("BON POUR ACCORD", W - M - bw + 4, y + 5.5);
    pdf.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    pdf.text(pdf.splitTextToSize("Date et signature du client, précédées de la mention « Bon pour accord, devis reçu avant l'exécution des travaux »", bw - 8), W - M - bw + 4, y + 9.5);
    if (doc.signature) {
      pdf.addImage(doc.signature.image, "PNG", W - M - bw + 4, y + 15, 50, 16);
      pdf.setFontSize(7.5).setTextColor(...INK).text(`${doc.signature.name} — signé le ${new Date(doc.signature.at).toLocaleString("fr-FR")}`, W - M - bw + 4, y + 35);
    }
    pdf.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK).text("L'ENTREPRISE", M, y + 5.5);
    pdf.setFont("helvetica", "normal").setFontSize(8).text([c.owner, c.name].filter(Boolean), M, y + 10.5);
  }

  footer(pdf, data);
  pdf.setProperties({ title: `${docTitle(doc)} ${doc.number ?? ""}`, author: c.name, creator: "Biltov" });
  return pdf;
}

const PHASE_LABEL: Record<PhotoPhase, string> = { avant: "Avant travaux", pendant: "Pendant les travaux", apres: "Après travaux" };

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

/** Rapport photo horodaté du chantier (avant / pendant / après). */
export async function buildPhotoReport(job: Job, photos: Photo[], data: AccountData, getBlob: (id: string) => Promise<Blob | undefined>) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = header(pdf, data, "RAPPORT PHOTO", [
    ["Chantier", job.name],
    ["Date", fmtDate(new Date().toISOString())],
  ]);
  y += box(pdf, M, y, W - 2 * M, "Client et lieu", [job.client, job.siteAddress || job.clientAddress]) + 6;

  const colW = (W - 2 * M - 6) / 2;

  // Planche comparative : première photo « avant » et dernière photo « après », côte à côte
  const sorted = [...photos].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  const firstBefore = sorted.find((p) => p.phase === "avant");
  const lastAfter = [...sorted].reverse().find((p) => p.phase === "apres");
  if (firstBefore && lastAfter) {
    pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...hexToRgb(data.branding.color)).text("Comparatif avant / après", M, y);
    y += 4;
    const h = 62;
    for (const [k, p] of [firstBefore, lastAfter].entries()) {
      const blob = await getBlob(p.id);
      if (!blob) continue;
      const x = M + k * (colW + 6);
      // recadrage centré dans un cadre fixe pour aligner les deux vues
      const img = await blobToDataUrl(blob);
      const ratio = Math.min(colW / p.width, h / p.height);
      const w = p.width * ratio;
      const hh = p.height * ratio;
      pdf.setFillColor(241, 245, 249).rect(x, y, colW, h, "F");
      pdf.addImage(img, "JPEG", x + (colW - w) / 2, y + (h - hh) / 2, w, hh);
      pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK).text(k === 0 ? "AVANT" : "APRÈS", x, y + h + 4.5);
      pdf.setFont("helvetica", "normal").setTextColor(...MUTED).text(new Date(p.takenAt).toLocaleString("fr-FR"), x + colW, y + h + 4.5, { align: "right" });
    }
    y += h + 12;
  }

  for (const phase of ["avant", "pendant", "apres"] as PhotoPhase[]) {
    const list = photos.filter((p) => p.phase === phase).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    if (!list.length) continue;
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold").setFontSize(11).setTextColor(...hexToRgb(data.branding.color)).text(PHASE_LABEL[phase], M, y);
    y += 4;
    for (let i = 0; i < list.length; i += 2) {
      const pair = list.slice(i, i + 2);
      const heights = pair.map((p) => Math.min(75, (colW / p.width) * p.height));
      const rowH = Math.max(...heights) + 11;
      y = ensureSpace(pdf, y, rowH);
      for (let k = 0; k < pair.length; k++) {
        const p = pair[k];
        const blob = await getBlob(p.id);
        if (!blob) continue;
        const x = M + k * (colW + 6);
        const h = heights[k];
        const w = Math.min(colW, (h / p.height) * p.width);
        pdf.addImage(await blobToDataUrl(blob), "JPEG", x, y, w, h);
        pdf.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
        pdf.text(`${new Date(p.takenAt).toLocaleString("fr-FR")}${p.caption ? ` — ${p.caption}` : ""}`, x, y + h + 4, { maxWidth: colW });
      }
      y += rowH;
    }
    y += 2;
  }
  footer(pdf, data);
  pdf.setProperties({ title: `Rapport photo — ${job.name}`, author: data.company.name, creator: "Biltov" });
  return pdf;
}

