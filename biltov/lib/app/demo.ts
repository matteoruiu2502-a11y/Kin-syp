// Espace de démonstration belge : entreprise, clients et chantiers fictifs, pour découvrir Biltov sans compte.

import { idbSet } from "./db";
import { addDays, emptyAccountData, newArticle, newClient, newJob, newLine, nowIso, todayIso, uid } from "./defaults";
import { addPayment, createQuote, issueDoc, logSend, quoteToInvoice, signQuote } from "./ops";
import { recalcAll } from "./catalog/pricing";
import { computeTotals } from "./money";
import { importMoves } from "./bank";
import type { Account, AccountData, GenericRecord, Photo } from "./types";

export const DEMO_ID = "demo";
export const demoAccount: Account = { id: DEMO_ID, email: "demo@biltov.be", salt: "", hash: "", createdAt: new Date(0).toISOString() };

const d0 = (n: number) => addDays(todayIso(), n);

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
  } else {
    g.fillStyle = "#eef2f5";
    g.fillRect(0, 0, 1200, 720);
    g.strokeStyle = "#cfd8dc";
    g.lineWidth = 3;
    for (let x = 0; x <= 1200; x += 150) g.strokeRect(x, 0, 150, 720);
    for (let y = 0; y <= 720; y += 75) g.strokeRect(0, y, 1200, 75);
    g.fillStyle = "#b08560";
    g.fillRect(0, 720, 1200, 180);
  }
  g.fillStyle = "rgba(0,0,0,.55)";
  g.fillRect(40, 40, 330, 70);
  g.fillStyle = "#fff";
  g.font = "bold 40px sans-serif";
  g.fillText(kind === "avant" ? "AVANT" : "APRÈS", 60, 90);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

const rec = (module: GenericRecord["module"], title: string, status: string, fields: GenericRecord["fields"], extra: Partial<GenericRecord> = {}): GenericRecord => ({ id: uid(), module, title, status, fields, jobId: null, clientId: null, memberId: null, createdAt: nowIso(), updatedAt: nowIso(), ...extra });

export async function buildDemoData(): Promise<AccountData> {
  let d = emptyAccountData("info@dupont-renovation.be");
  d.company = {
    ...d.company,
    name: "Dupont Rénovation SRL (démo)",
    owner: "Jean Dupont",
    legalForm: "SRL",
    address: { street: "Rue des Artisans 12", postcode: "4000", city: "Liège", country: "BE" },
    phone: "04 123 45 67",
    email: "info@dupont-renovation.be",
    bce: "0799.999.085",
    rpm: "RPM Liège",
    insurer: "Assureur Exemple SA",
    insurerContact: "Boulevard d'Avroy 1, 4000 Liège",
    policyNumber: "RC-000000",
    iban: "BE68 5390 0754 7034",
    bic: "GKCCBEBB",
    trade: "plombier",
  };

  // Équipe
  const patron = { id: uid(), name: "Jean Dupont", role: "owner" as const, phone: "0470 00 00 01", email: "jean@dupont.be", lang: "fr" as const, hourlyCost: 0, color: "#0066FF", pin: "1111", active: true };
  const karim = { id: uid(), name: "Karim B.", role: "worker" as const, phone: "0470 00 00 02", email: "", lang: "fr" as const, hourlyCost: 38, color: "#10B981", pin: "2222", active: true };
  const piotr = { id: uid(), name: "Piotr K.", role: "worker" as const, phone: "0470 00 00 03", email: "", lang: "nl" as const, hourlyCost: 36, color: "#F59E0B", pin: "3333", active: true };
  d.members = [patron, karim, piotr];

  // Fournisseurs et sous-traitants
  const negoce = { id: uid(), kind: "supplier" as const, name: "Négoce Matériaux (démo)", bce: "0712.345.036", email: "commandes@negoce.be", phone: "04 000 00 00", address: { street: "Quai 5", postcode: "4020", city: "Liège", country: "BE" }, trade: "" as const, importMapping: null, notes: "" };
  const soustraitant = { id: uid(), kind: "subcontractor" as const, name: "Électricité Martin (démo)", bce: "0654.321.022", email: "martin@elec.be", phone: "0471 00 00 00", address: { street: "Rue Haute 3", postcode: "4100", city: "Seraing", country: "BE" }, trade: "electricien" as const, importMapping: null, notes: "" };
  d.suppliers = [negoce, soustraitant];

  // Catalogue
  const a = (ref: string, fr: string, nl: string, de: string, unit: string, purchase: number, margin: number, type: "supply" | "labour" = "supply", category: "installed_material" | "labour" | "supply_only" = type === "labour" ? "labour" : "installed_material", family = "Sanitaire") =>
    newArticle({ ref, name: { fr, nl, de }, unit, purchasePrice: purchase, marginPercent: margin, type, category, family, trade: "plombier", supplierId: type === "supply" ? negoce.id : null });
  const moPlomb = a("MO-PLB", "Main-d'œuvre plombier", "Arbeidsloon loodgieter", "Arbeitszeit Installateur", "h", 38, 45, "labour", "labour", "Main-d'œuvre");
  const moCarr = a("MO-CAR", "Main-d'œuvre carreleur", "Arbeidsloon tegelzetter", "Arbeitszeit Fliesenleger", "h", 36, 50, "labour", "labour", "Main-d'œuvre");
  const receveur = a("REC-90", "Receveur de douche extra-plat 90×120", "Extra platte douchebak 90×120", "Flache Duschwanne 90×120", "u", 260, 40);
  const mitigeur = a("MIT-TH", "Mitigeur thermostatique douche", "Thermostatische douchemengkraan", "Thermostat-Duscharmatur", "u", 140, 40);
  const faience = a("FAI-3060", "Faïence murale 30×60", "Wandtegel 30×60", "Wandfliese 30×60", "m²", 24, 45, "supply", "installed_material", "Carrelage");
  const colle = a("COL-C2", "Colle carrelage C2 25 kg", "Tegellijm C2 25 kg", "Fliesenkleber C2 25 kg", "u", 17, 40, "supply", "installed_material", "Carrelage");
  const joint = a("JNT-5", "Joint gris 5 kg", "Voegmiddel grijs 5 kg", "Fugenmörtel grau 5 kg", "u", 11, 40, "supply", "installed_material", "Carrelage");
  const boiler = a("BOIL-200", "Chauffe-eau électrique 200 L", "Elektrische boiler 200 L", "Elektro-Warmwasserspeicher 200 L", "u", 390, 30);
  const chaudiere = a("CH-GAZ", "Chaudière gaz à condensation 24 kW", "Condensatieketel gas 24 kW", "Gas-Brennwertkessel 24 kW", "u", 1650, 25, "supply", "installed_material", "Chauffage");
  const entretien = a("ENT-CH", "Entretien annuel chaudière", "Jaarlijks onderhoud ketel", "Jährliche Kesselwartung", "forfait", 60, 80, "labour", "labour", "Chauffage");
  const pac = a("PAC-8", "Pompe à chaleur air-eau 8 kW", "Lucht-water warmtepomp 8 kW", "Luft-Wasser-Wärmepumpe 8 kW", "u", 5200, 25, "supply", "installed_material", "Chauffage");
  const kit = newArticle({ ref: "OUV-FAI", name: { fr: "Pose faïence murale (ouvrage / m²)", nl: "Plaatsing wandtegels (per m²)", de: "Verlegung Wandfliesen (je m²)" }, unit: "m²", type: "package", category: "installed_material", family: "Carrelage", trade: "plombier", components: [{ articleId: faience.id, qty: 1.1 }, { articleId: colle.id, qty: 0.2 }, { articleId: joint.id, qty: 0.1 }, { articleId: moCarr.id, qty: 0.8 }] });
  const depose = a("DEP-CAR", "Dépose ancien carrelage", "Verwijderen oude tegels", "Abbruch alte Fliesen", "m²", 8, 60, "labour", "labour", "Carrelage");
  kit.related = [depose.id];
  chaudiere.category = "fossil_boiler_install";
  entretien.category = "fossil_boiler_service";
  pac.category = "heat_pump";
  d.articles = recalcAll([moPlomb, moCarr, receveur, mitigeur, faience, colle, joint, boiler, chaudiere, entretien, pac, kit, depose]);

  // Clients
  const durand = newClient({ kind: "particulier", name: "Paul Durand", lang: "fr", email: "paul.durand@exemple.be", phone: "0475 12 34 56", billing: { street: "Avenue Rogier 8", postcode: "4000", city: "Liège", country: "BE" }, source: "Bouche-à-oreille", marketingConsent: true });
  const peeters = newClient({ kind: "particulier", name: "An Peeters", lang: "nl", email: "an.peeters@voorbeeld.be", phone: "0476 98 76 54", billing: { street: "Kerkstraat 21", postcode: "9000", city: "Gent", country: "BE" }, source: "Site web" });
  const bouw = newClient({ kind: "assujetti", name: "Bouw & Co NV (démo)", contactName: "Dhr. Jansens", lang: "nl", bce: "0888.888.006", vatNumber: "BE0888888006", email: "facturen@bouwco.be", phone: "09 000 00 00", billing: { street: "Industrieweg 4", postcode: "9000", city: "Gent", country: "BE" }, priceListId: "pro", source: "Architecte" });
  const horizon = newClient({ kind: "assujetti", name: "SCI Horizon SA (démo)", lang: "fr", bce: "0712.345.036", vatNumber: "BE0712345036", email: "gestion@horizon.be", billing: { street: "Place Saint-Lambert 1", postcode: "4000", city: "Liège", country: "BE" }, priceListId: "pro" });
  d.clients = [durand, peeters, bouw, horizon];

  // Chantiers
  const jDurand = newJob({ clientId: durand.id, name: "Salle de bain Durand", trade: "plombier", status: "in_progress", date: d0(-40), firstOccupationYear: 1978, startDate: d0(-30), endDate: d0(5), memberIds: [karim.id], probability: 100 });
  const jPeeters = newJob({ clientId: peeters.id, name: "Badkamer Peeters", trade: "plombier", status: "sent", date: d0(-4), firstOccupationYear: 2019, probability: 60 });
  const jBouw = newJob({ clientId: bouw.id, name: "Appartementen Bouw & Co — sanitair", trade: "plombier", status: "in_progress", date: d0(-50), memberIds: [piotr.id, karim.id], probability: 100 });
  const jHorizon = newJob({ clientId: horizon.id, name: "Remplacement chaudière Horizon", trade: "plombier", status: "draft", date: d0(0), privateHousing: false, probability: 40 });
  const jLead = newJob({ clientId: durand.id, name: "Visite : cuisine Durand (métré)", status: "lead", date: d0(1), probability: 20 });
  d.jobs = [jLead, jHorizon, jPeeters, jBouw, jDurand];

  const line = (art: (typeof d.articles)[number], qty: number) => newLine({ articleId: art.id, label: art.name.fr, qty, unit: art.unit, unitPrice: d.articles.find((x) => x.id === art.id)!.salePrice, category: art.category, costPrice: d.articles.find((x) => x.id === art.id)!.purchasePrice });
  const lineNl = (art: (typeof d.articles)[number], qty: number) => ({ ...line(art, qty), label: art.name.nl });

  // Durand : devis signé, acompte payé, facture finale en retard (1er rappel gratuit à envoyer)
  let q: ReturnType<typeof createQuote>[1];
  [d, q] = createQuote(d, jDurand.id, [newLine({ kind: "section", label: "Démolition" }), line(depose, 12), newLine({ kind: "section", label: "Sanitaire" }), line(receveur, 1), line(mitigeur, 1), line(moPlomb, 10), newLine({ kind: "section", label: "Carrelage" }), line(kit, 18), { ...line(boiler, 1), optional: true, selected: false }], { issueDate: d0(-40) });
  d = signQuote(d, q.id, { image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", name: "Paul Durand", at: new Date(Date.now() - 39 * 864e5).toISOString() });
  let inv: ReturnType<typeof quoteToInvoice>[1];
  [d, inv] = quoteToInvoice(d, q.id, "deposit", { percent: 30 });
  let issued: ReturnType<typeof issueDoc>[1];
  [d, issued] = issueDoc(d, inv.id);
  d = addPayment(d, issued!.id, { date: d0(-35), amount: computeTotals(issued!).tvac, method: "Virement", reference: issued!.structuredComm });
  [d, inv] = quoteToInvoice(d, q.id, "final");
  [d, issued] = issueDoc(d, inv.id);
  d = { ...d, docs: d.docs.map((x) => (x.id === issued!.id ? { ...x, issueDate: d0(-12), dueDate: d0(-2) } : x)) };
  d = logSend(d, issued!.id, { channel: "email", kind: "document" });

  // Peeters : offerte en néerlandais envoyée
  [d, q] = createQuote(d, jPeeters.id, [lineNl(receveur, 1), lineNl(mitigeur, 1), lineNl(moPlomb, 8), lineNl(kit, 14)]);
  d = logSend(d, q.id, { channel: "whatsapp", kind: "document" });

  // Bouw & Co : autoliquidation, facture de situation émise (prête pour Peppol)
  [d, q] = createQuote(d, jBouw.id, [lineNl(boiler, 6), lineNl(moPlomb, 48)], { issueDate: d0(-50) });
  d = signQuote(d, q.id, { image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", name: "Dhr. Jansens", at: new Date(Date.now() - 48 * 864e5).toISOString() });
  const qb = d.docs.find((x) => x.id === q.id)!;
  [d, inv] = quoteToInvoice(d, q.id, "situation", { progress: Object.fromEntries(qb.lines.map((l) => [l.id, 50])) });
  [d, issued] = issueDoc(d, inv.id);

  // Horizon : devis brouillon chaudière (bâtiment non résidentiel → 21 %)
  [d, q] = createQuote(d, jHorizon.id, [line(chaudiere, 1), line(moPlomb, 12)]);

  // Photos Durand
  const photos: Photo[] = [];
  for (const [phase, off] of [["avant", -31], ["apres", -1]] as const) {
    const p: Photo = { id: uid(), jobId: jDurand.id, phase, caption: phase === "avant" ? "Salle de bain d'origine" : "Douche terminée", takenAt: new Date(Date.now() + off * 864e5).toISOString(), addedAt: nowIso(), width: 1200, height: 900 };
    await idbSet(`blob:photo:${p.id}`, await drawPhoto(phase));
    photos.push(p);
  }
  d.photos = photos;

  // Pointage, planning, rapports
  d.timeEntries = [
    { id: uid(), memberId: karim.id, jobId: jDurand.id, date: d0(-3), start: "07:30", end: "16:00", hours: 8, note: "Pose faïence" },
    { id: uid(), memberId: karim.id, jobId: jDurand.id, date: d0(-2), start: "07:30", end: "15:30", hours: 7.5, note: "Joints + receveur" },
    { id: uid(), memberId: piotr.id, jobId: jBouw.id, date: d0(-2), start: "08:00", end: "16:30", hours: 8, note: "Boilers app. 1-3" },
  ];
  const at = (days: number, h: number) => `${d0(days)}T${String(h).padStart(2, "0")}:00`;
  d.events = [
    { id: uid(), kind: "job", title: "Salle de bain Durand — finitions", jobId: jDurand.id, clientId: durand.id, memberIds: [karim.id], start: at(0, 8), end: at(0, 16), notes: "", status: "planned" },
    { id: uid(), kind: "job", title: "Bouw & Co — boilers app. 4-6", jobId: jBouw.id, clientId: bouw.id, memberIds: [piotr.id], start: at(1, 8), end: at(1, 16), notes: "", status: "planned" },
    { id: uid(), kind: "visit", title: "Métré cuisine Durand", jobId: jLead.id, clientId: durand.id, memberIds: [patron.id], start: at(1, 10), end: at(1, 11), notes: "", status: "planned" },
    { id: uid(), kind: "leave", title: "Congé Piotr", jobId: null, clientId: null, memberIds: [piotr.id], start: at(4, 0), end: at(4, 23), notes: "", status: "requested" },
  ];
  d.reports = [
    { id: uid(), jobId: jDurand.id, kind: "daily", date: d0(-2), memberIds: [karim.id], checklist: [{ label: "Receveur posé et testé", done: true }, { label: "Joints silicone", done: true }, { label: "Nettoyage", done: false }], notes: "Reste la pose des accessoires.", photoIds: [], hours: 7.5, materials: [{ label: "Joint gris", qty: 1, unit: "u" }], signature: null, sentAt: null },
  ];

  // Achats : facture fournisseur + sous-traitance avec contrôle de retenue
  d.purchases = [
    { id: uid(), type: "invoice", supplierId: negoce.id, jobId: jDurand.id, number: "NM-2026-1182", date: d0(-29), dueDate: d0(1), lines: [{ id: uid(), articleId: receveur.id, label: "Receveur 90×120", qty: 1, unitPrice: 260, vat: 21 }, { id: uid(), articleId: faience.id, label: "Faïence 30×60", qty: 20, unitPrice: 24, vat: 21 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null },
    { id: uid(), type: "invoice", supplierId: soustraitant.id, jobId: jBouw.id, number: "EM-114", date: d0(-10), dueDate: d0(20), lines: [{ id: uid(), articleId: null, label: "Raccordements électriques boilers", qty: 1, unitPrice: 1800, vat: 0 }], status: "to_pay", source: "manual", retention: null, paidAt: null, fileId: null },
    { id: uid(), type: "order", supplierId: negoce.id, jobId: jBouw.id, number: "BC-2026-0001", date: d0(-1), dueDate: d0(6), lines: [{ id: uid(), articleId: boiler.id, label: "Boiler 200 L", qty: 3, unitPrice: 390, vat: 21 }], status: "ordered", source: "manual", retention: null, paidAt: null, fileId: null },
  ];
  d.expenses = [{ id: uid(), jobId: jDurand.id, memberId: karim.id, date: d0(-3), supplier: "Brico", label: "Silicone + embouts", amountTTC: 24.2, vat: 21, receiptId: null, reimbursable: true, status: "submitted" }];

  // Stock et flotte
  const van = { id: uid(), plate: "1-ABC-123", model: "Renault Master", memberId: karim.id, nextInspection: d0(45), nextService: d0(12), mileage: 84200, costs: [{ date: d0(-20), label: "Pneus", amount: 480, jobId: null }] };
  d.vehicles = [van];
  d.stockLocations = [
    { id: "depot", name: "Dépôt", kind: "depot", vehicleId: null },
    { id: uid(), name: "Camionnette 1-ABC-123", kind: "vehicle", vehicleId: van.id },
  ];
  d.stockMoves = [
    { id: uid(), articleId: colle.id, locationId: "depot", qty: 12, date: d0(-30), reason: "Réception", jobId: null },
    { id: uid(), articleId: colle.id, locationId: "depot", qty: -4, date: d0(-3), reason: "Sortie chantier", jobId: jDurand.id },
    { id: uid(), articleId: joint.id, locationId: d.stockLocations[1].id, qty: 3, date: d0(-10), reason: "Chargement", jobId: null },
  ];
  d.articles = d.articles.map((x) => (x.id === colle.id ? { ...x, minStock: 10 } : x));

  // Modules complémentaires
  d.records = [
    rec("helpdesk", "Fuite sous l'évier après intervention", "open", { priority: "Haute", deadline: d0(2) }, { clientId: durand.id, jobId: jDurand.id }),
    rec("knowledge", "Check-list réception salle de bain", "published", { content: "1. Test d'étanchéité 24 h\n2. Pente d'évacuation\n3. Joints silicone\n4. Photos après travaux\n5. PV de réception signé" }),
    rec("maintenance", "Carotteuse Hilti — révision", "planned", { due: d0(20), cost: 120 }),
    rec("rentals", "Échafaudage roulant 6 m", "out", { from: d0(-5), to: d0(5), dailyRate: 25, billTo: "client" }, { jobId: jBouw.id }),
    rec("recruitment", "Plombier-chauffagiste (CDI)", "open", { candidates: 2 }),
    rec("surveys", "Satisfaction — Salle de bain Durand", "sent", { score: "" }, { clientId: durand.id, jobId: jDurand.id }),
    rec("chat", "Karim B.", "message", { text: "Il manque 2 sacs de colle pour finir demain." }, { jobId: jDurand.id, memberId: karim.id }),
  ];
  d.settings = { ...d.settings, modules: { ...d.settings.modules, recruitment: true, marketing: true, website: true, subnetwork: true } };
  // Banque : un extrait importé (un virement à lettrer, des frais bancaires)
  const open3 = d.docs.find((x) => x.number === "F-2026-0003");
  if (open3) {
    [d] = importMoves(d, [
      { amount: Math.round(computeTotals(open3).due * 100) / 100, date: d0(-1), communication: "Facture appartementen", structured: false, counterparty: "BOUW & CO NV", account: "BE71096123456769", ref: "DEMO-1" },
      { amount: -12.5, date: d0(-2), communication: "Frais de gestion de compte", structured: false, counterparty: "Banque", account: "", ref: "DEMO-2" },
    ]);
  }
  // Sous-traitant : attestations
  d.suppliers = d.suppliers.map((s) => (s.kind === "subcontractor" ? { ...s, attestations: [{ id: uid(), kind: "insurance_rc", reference: "RC-55120", validUntil: d0(20), fileId: null }, { id: uid(), kind: "onss", reference: "", validUntil: d0(-3), fileId: null }] } : s));
  // Parc d'outils
  d.tools = [
    { id: uid(), name: "Minipelle 1,8 t", category: "Machine", serial: "KB-18-2291", purchaseDate: d0(-400), value: 24000, assignment: { type: "job", id: jBouw.id }, history: [{ at: nowIso(), assignment: { type: "job", id: jBouw.id }, note: "Tranchées" }], serviceIntervalDays: 180, lastService: d0(-170), status: "ok", notes: "" },
    { id: uid(), name: "Laser rotatif", category: "Mesure", serial: "LR-7781", purchaseDate: d0(-700), value: 1450, assignment: { type: "member", id: karim.id }, history: [], serviceIntervalDays: 365, lastService: d0(-100), status: "ok", notes: "" },
    { id: uid(), name: "Disqueuse 230 mm", category: "Électroportatif", serial: "", purchaseDate: d0(-300), value: 280, assignment: { type: "vehicle", id: van.id }, history: [], serviceIntervalDays: null, lastService: null, status: "repair", notes: "Charbons à changer" },
  ];
  // Contrat d'entretien récurrent
  d.contracts = [
    { id: uid(), clientId: durand.id, jobId: null, title: "Entretien annuel chaudière — Durand", frequency: "yearly", startDate: d0(-360), nextDate: d0(5), endDate: null, lines: [{ label: "Entretien chaudière gaz + attestation", qty: 1, unit: "forfait", unitPrice: 120, category: "fossil_boiler_service" }], memberIds: [karim.id], active: true, history: [] },
  ];
  return d;
}
