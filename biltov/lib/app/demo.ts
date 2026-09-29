// Espace de démonstration : entreprise et données fictives, pour découvrir Biltov sans compte.

import { addDays, defaultSettings, emptyCompany, newDoc, newJob, todayIso, uid } from "./defaults";
import { idbSet } from "./db";
import type { Account, AccountData, Doc, Line, Photo, VatRate } from "./types";

export const DEMO_ID = "demo";
export const demoAccount: Account = { id: DEMO_ID, email: "demo@biltov.fr", salt: "", hash: "", createdAt: new Date(0).toISOString() };

const L = (label: string, qty: number, unit: string, unitPrice: number, vat: VatRate = 10): Line => ({ id: uid(), label, qty, unit, unitPrice, vat });
const d = (days: number) => addDays(todayIso(), days);

/** Photo de démonstration dessinée à la volée (aucun fichier à télécharger). */
async function drawPhoto(kind: "avant" | "apres"): Promise<Blob> {
  const c = Object.assign(document.createElement("canvas"), { width: 1200, height: 900 });
  const g = c.getContext("2d")!;
  if (kind === "avant") {
    g.fillStyle = "#7a6f62";
    g.fillRect(0, 0, 1200, 900);
    g.fillStyle = "#5e554b";
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 1200, (i * 211) % 900, 60 + (i % 5) * 20, 30 + (i % 3) * 25);
    g.strokeStyle = "#2b2622";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(200, 80);
    g.lineTo(320, 300);
    g.lineTo(280, 520);
    g.lineTo(420, 760);
    g.stroke();
    g.fillStyle = "#8b8378";
    g.fillRect(0, 720, 1200, 180);
  } else {
    g.fillStyle = "#eef2f5";
    g.fillRect(0, 0, 1200, 720);
    g.strokeStyle = "#cfd8dc";
    g.lineWidth = 3;
    for (let x = 0; x <= 1200; x += 150) g.strokeRect(x, 0, 150, 720);
    for (let y = 0; y <= 720; y += 75) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(1200, y);
      g.stroke();
    }
    const grad = g.createLinearGradient(0, 720, 1200, 900);
    grad.addColorStop(0, "#a0764f");
    grad.addColorStop(1, "#c79a6b");
    g.fillStyle = grad;
    g.fillRect(0, 720, 1200, 180);
  }
  g.fillStyle = "rgba(0,0,0,.55)";
  g.fillRect(40, 40, 330, 70);
  g.fillStyle = "#fff";
  g.font = "bold 40px sans-serif";
  g.fillText(kind === "avant" ? "AVANT" : "APRÈS", 60, 90);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export async function buildDemoData(): Promise<AccountData> {
  const company = {
    ...emptyCompany("contact@dupont-renovation.fr"),
    name: "Dupont Rénovation (démo)",
    owner: "Jean Dupont",
    legalForm: "SARL" as const,
    capital: "10 000 €",
    address: "12 rue des Artisans",
    postcode: "69003",
    city: "Lyon",
    phone: "04 78 00 00 00",
    siret: "90012345600007",
    registry: "RCS Lyon 900 123 456",
    vatNumber: "FR" + String((12 + 3 * (900123456 % 97)) % 97).padStart(2, "0") + "900123456",
    insurer: "Assureur Exemple",
    insurerContact: "1 place de la Bourse, 69002 Lyon",
    policyNumber: "DEC-000000",
    coverage: "France métropolitaine",
    mediatorName: "Médiateur Exemple",
    mediatorUrl: "https://www.exemple-mediateur.fr",
    iban: "FR76 3000 6000 0112 3456 7890 189",
    bic: "AGRIFRPP",
  };

  const durand = newJob({ name: "Salle de bain Durand", client: "Paul Durand", clientAddress: "8 avenue Foch, 69006 Lyon", clientEmail: "paul.durand@exemple.fr", clientPhone: "06 12 34 56 78", city: "Lyon", trade: "plombier", status: "in_progress", date: d(-40), startDate: d(-30), duration: "5 jours", reducedVatEligible: true });
  const girard = newJob({ name: "Tableau électrique Girard", client: "Marc Girard", clientAddress: "3 rue Pasteur, 69100 Villeurbanne", clientPhone: "06 98 76 54 32", city: "Villeurbanne", trade: "electricien", status: "sent", date: d(-3), reducedVatEligible: true });
  const roux = newJob({ name: "Fenêtres PVC Roux", client: "Claire Roux", clientAddress: "14 chemin des Vignes, 69130 Écully", clientEmail: "claire.roux@exemple.fr", city: "Écully", trade: "menuisier", status: "done", date: d(-60), reducedVatEligible: true });
  const horizon = newJob({ name: "Local commercial SCI Horizon", client: "SCI Horizon", clientType: "professionnel", clientSiren: "900123456", clientAddress: "45 cours Lafayette, 69003 Lyon", clientEmail: "gestion@exemple.fr", city: "Lyon", trade: "peintre", status: "draft", date: d(0) });
  const bernard = newJob({ name: "Ravalement Bernard", client: "Alain Bernard", clientAddress: "2 impasse du Moulin, 69160 Tassin", city: "Tassin", trade: "peintre", status: "refused", date: d(-25), notes: "Trop cher selon le client" });

  const qDurand = newDoc({ jobId: durand.id, type: "quote", number: "D-2026-0001", status: "accepted", issueDate: d(-40), validUntil: d(-10), depositPercent: 30, lines: [L("Dépose ancienne baignoire et évacuation gravats", 1, "forfait", 380), L("Receveur extra-plat 90×120 + bonde", 1, "u", 540), L("Faïence murale 30×60 posée", 18, "m²", 68), L("Mitigeur thermostatique douche", 1, "u", 290), L("Main d'œuvre plombier", 16, "h", 55)] });
  const depDurand = newDoc({ jobId: durand.id, type: "invoice", kind: "deposit", number: "F-2026-0001", status: "paid", issueDate: d(-38), workDate: d(-38), dueDate: d(-38), lockedAt: d(-38), sourceId: qDurand.id, paidAt: d(-36), paymentMethod: "Virement", lines: [L("Acompte de 30 % sur devis D-2026-0001", 1, "forfait", 994.2)] });
  const qGirard = newDoc({ jobId: girard.id, type: "quote", number: "D-2026-0004", status: "sent", issueDate: d(-3), validUntil: d(27), depositPercent: 30, lines: [L("Tableau électrique 3 rangées 39 modules", 1, "u", 128), L("Interrupteur différentiel 40 A 30 mA type A", 2, "u", 74), L("Disjoncteur 16 A", 12, "u", 11.5), L("Main d'œuvre électricien", 6, "h", 55)], sends: [{ at: new Date(Date.now() - 3 * 864e5).toISOString(), channel: "whatsapp", kind: "document" }] });
  const qRoux = newDoc({ jobId: roux.id, type: "quote", number: "D-2026-0002", status: "accepted", issueDate: d(-60), validUntil: d(-30), lines: [L("Fenêtre PVC 2 vantaux 120×135 Uw 1,3", 3, "u", 540, 5.5), L("Dépose menuiserie bois existante", 3, "u", 65, 5.5), L("Habillage + couvre-joints", 3, "u", 48, 5.5)] });
  const fRoux = newDoc({ jobId: roux.id, type: "invoice", kind: "full", number: "F-2026-0002", status: "issued", issueDate: d(-40), workDate: d(-42), dueDate: d(-10), lockedAt: d(-40), sourceId: qRoux.id, lines: qRoux.lines.map((l) => ({ ...l, id: uid() })), sends: [{ at: new Date(Date.now() - 40 * 864e5).toISOString(), channel: "email", kind: "document" }] });
  const qHorizon = newDoc({ jobId: horizon.id, type: "quote", number: "D-2026-0005", status: "draft", issueDate: d(0), validUntil: d(30), depositPercent: 30, lines: [L("Lessivage et rebouchage des murs", 120, "m²", 6, 20), L("Peinture acrylique velours 2 couches", 120, "m²", 16, 20), L("Protection des sols et évacuation", 1, "forfait", 180, 20)] });
  const qBernard = newDoc({ jobId: bernard.id, type: "quote", number: "D-2026-0003", status: "refused", issueDate: d(-25), validUntil: d(5), lines: [L("Ravalement façade enduit", 140, "m²", 58), L("Échafaudage", 1, "forfait", 1200)] });

  const docs: Doc[] = [qHorizon, qGirard, qBernard, fRoux, qRoux, depDurand, qDurand];
  const settings = { ...defaultSettings(), counters: { "D-2026": 5, "F-2026": 2 } };

  // Photos du chantier Durand
  const photos: Photo[] = [];
  for (const [phase, offset] of [["avant", -31], ["apres", -2]] as const) {
    const p: Photo = { id: uid(), jobId: durand.id, phase, caption: phase === "avant" ? "Salle de bain d'origine" : "Douche à l'italienne terminée", takenAt: new Date(Date.now() + offset * 864e5).toISOString(), addedAt: new Date().toISOString(), width: 1200, height: 900 };
    await idbSet(`photo:${p.id}`, await drawPhoto(phase));
    photos.push(p);
  }

  return {
    company,
    branding: { color: "#0066FF", logo: null },
    settings,
    jobs: [
      { ...horizon, amount: 2820 },
      { ...girard, amount: 668 },
      { ...bernard, amount: 9320 },
      { ...durand, amount: 3314 },
      { ...roux, amount: 1959 },
    ],
    docs,
    photos,
    expenses: [
      { id: uid(), jobId: durand.id, date: d(-29), supplier: "Négoce Exemple", label: "Receveur + bonde + mitigeur", amountTTC: 612.4, vat: 20, receiptId: null },
      { id: uid(), jobId: durand.id, date: d(-27), supplier: "Négoce Exemple", label: "Faïence 30×60, colle, joints", amountTTC: 486.9, vat: 20, receiptId: null },
    ],
  };
}
