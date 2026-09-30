// Fabriques d'objets et numérotation.

import type { Article, AccountData, Client, Company, Doc, Job, Line, ModuleId, Settings } from "./types";
import { emptyAddress } from "./types";

export const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 12);
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const ALL_MODULES: ModuleId[] = ["catalog", "clients", "planning", "time", "reports", "purchases", "stock", "fleet", "rentals", "maintenance", "expenses", "documents", "helpdesk", "leaves", "recruitment", "knowledge", "surveys", "chat", "appointments", "marketing", "website", "subnetwork", "manufacturing"];

export const emptyCompany = (email = ""): Company => ({
  name: "",
  owner: "",
  legalForm: "Personne physique",
  address: emptyAddress(),
  phone: "",
  email,
  website: "",
  bce: "",
  vatRegime: "normal",
  rpm: "",
  insurer: "",
  insurerContact: "",
  policyNumber: "",
  iban: "",
  bic: "",
  trade: "plombier",
  lang: "fr",
});

const tpl = (fr: string, nl: string, de: string) => ({ fr, nl, de });

export const defaultReminderTemplates = (): Settings["reminderTemplates"] => [
  {
    subject: tpl("Rappel — facture {numero}", "Herinnering — factuur {numero}", "Zahlungserinnerung — Rechnung {numero}"),
    body: tpl(
      "Bonjour {client},\n\nSauf erreur de notre part, la facture {numero} du {date} ({prestation}) d'un montant de {montant}, échue le {echeance}, reste impayée.\n\nMerci de la régler dans un délai de 14 jours, sur le compte {iban} avec la communication {communication}.\n\n{mention_b2c}\n\nCordialement,\n{entreprise} — BCE {bce}",
      "Beste {client},\n\nTenzij wij ons vergissen, is factuur {numero} van {date} ({prestation}) voor een bedrag van {montant}, vervallen op {echeance}, nog niet betaald.\n\nGelieve ze binnen 14 dagen te betalen op rekening {iban} met de mededeling {communication}.\n\n{mention_b2c}\n\nMet vriendelijke groeten,\n{entreprise} — KBO {bce}",
      "Guten Tag {client},\n\nsofern wir uns nicht irren, ist die Rechnung {numero} vom {date} ({prestation}) über {montant}, fällig am {echeance}, noch offen.\n\nBitte begleichen Sie sie innerhalb von 14 Tagen auf das Konto {iban} mit der Mitteilung {communication}.\n\n{mention_b2c}\n\nMit freundlichen Grüßen\n{entreprise} — ZDU {bce}",
    ),
  },
  {
    subject: tpl("Deuxième rappel — facture {numero}", "Tweede herinnering — factuur {numero}", "Zweite Mahnung — Rechnung {numero}"),
    body: tpl(
      "Bonjour {client},\n\nMalgré notre précédent rappel, la facture {numero} ({montant}) reste impayée. Montant à régler : {montant_total}, frais et intérêts compris ({frais}).\n\nCompte {iban}, communication {communication}.\n\nCordialement,\n{entreprise}",
      "Beste {client},\n\nOndanks onze vorige herinnering is factuur {numero} ({montant}) nog steeds niet betaald. Te betalen bedrag: {montant_total}, kosten en interesten inbegrepen ({frais}).\n\nRekening {iban}, mededeling {communication}.\n\nMet vriendelijke groeten,\n{entreprise}",
      "Guten Tag {client},\n\ntrotz unserer vorherigen Erinnerung ist die Rechnung {numero} ({montant}) weiterhin offen. Zu zahlender Betrag: {montant_total}, einschließlich Kosten und Zinsen ({frais}).\n\nKonto {iban}, Mitteilung {communication}.\n\nMit freundlichen Grüßen\n{entreprise}",
    ),
  },
  {
    subject: tpl("Mise en demeure — facture {numero}", "Ingebrekestelling — factuur {numero}", "Inverzugsetzung — Rechnung {numero}"),
    body: tpl(
      "Bonjour {client},\n\nPar la présente, nous vous mettons en demeure de régler la somme de {montant_total} ({frais}) relative à la facture {numero} dans les 8 jours. À défaut, nous confierons le dossier au recouvrement.\n\nCompte {iban}, communication {communication}.\n\n{entreprise}",
      "Beste {client},\n\nHierbij stellen wij u in gebreke om het bedrag van {montant_total} ({frais}) met betrekking tot factuur {numero} binnen 8 dagen te betalen. Zo niet, dragen wij het dossier over voor invordering.\n\nRekening {iban}, mededeling {communication}.\n\n{entreprise}",
      "Guten Tag {client},\n\nhiermit setzen wir Sie in Verzug, den Betrag von {montant_total} ({frais}) für die Rechnung {numero} innerhalb von 8 Tagen zu zahlen. Andernfalls übergeben wir die Angelegenheit dem Inkasso.\n\nKonto {iban}, Mitteilung {communication}.\n\n{entreprise}",
    ),
  },
];

export const defaultSettings = (): Settings => ({
  quoteValidityDays: 30,
  paymentTermsDays: 30,
  depositPercent: 30,
  prefixes: { quote: "D", invoice: "F", credit: "NC", proforma: "PF", order: "BC" },
  counters: {},
  modules: Object.fromEntries(ALL_MODULES.map((m) => [m, !["manufacturing", "subnetwork", "recruitment", "marketing", "website"].includes(m)])) as Settings["modules"],
  reminderTemplates: defaultReminderTemplates(),
  priceLists: [
    { id: "default", name: "Particuliers", discountPercent: 0, familyDiscounts: {} },
    { id: "pro", name: "Professionnels", discountPercent: 5, familyDiscounts: {} },
  ],
  retentionGuaranteePercent: 0,
  terms: { b2c: "", b2b: "" },
});

export const emptyAccountData = (email: string): AccountData => ({
  version: 2,
  company: emptyCompany(email),
  branding: { color: "#0066FF", logo: null },
  settings: defaultSettings(),
  clients: [],
  jobs: [],
  docs: [],
  articles: [],
  suppliers: [],
  purchases: [],
  expenses: [],
  photos: [],
  members: [],
  timeEntries: [],
  events: [],
  reports: [],
  stockLocations: [{ id: "depot", name: "Dépôt", kind: "depot", vehicleId: null }],
  stockMoves: [],
  vehicles: [],
  records: [],
  audit: [],
});

export const newClient = (p: Partial<Client> = {}): Client => ({
  id: uid(),
  kind: "particulier",
  name: "",
  contactName: "",
  bce: "",
  vatNumber: "",
  lang: "fr",
  email: "",
  phone: "",
  billing: emptyAddress(),
  sites: [],
  notes: "",
  tags: [],
  priceListId: null,
  source: "",
  marketingConsent: false,
  peppolId: "",
  createdAt: nowIso(),
  ...p,
});

export const newJob = (p: Partial<Job> & { clientId: string }): Job => ({
  id: uid(),
  name: "",
  trade: "plombier",
  status: "draft",
  date: todayIso(),
  siteId: null,
  siteAddress: "",
  workKind: "immobilier",
  privateHousing: true,
  firstOccupationYear: null,
  offPremises: false,
  startDate: "",
  endDate: "",
  memberIds: [],
  notes: "",
  amount: 0,
  probability: 50,
  salesRep: "",
  weatherSensitive: false,
  ...p,
});

export const newLine = (p: Partial<Line> = {}): Line => ({
  id: uid(),
  kind: "item",
  articleId: null,
  label: "",
  qty: 1,
  unit: "u",
  unitPrice: 0,
  discountPercent: 0,
  category: "labour",
  vat: "21",
  vatOverridden: false,
  optional: false,
  selected: true,
  toPrice: false,
  confidence: null,
  costPrice: 0,
  progressPercent: 0,
  ...p,
});

export const newDoc = (p: Partial<Doc> & Pick<Doc, "jobId" | "clientId" | "type">): Doc => ({
  id: uid(),
  kind: "full",
  number: null,
  version: 1,
  previousId: null,
  status: "draft",
  lang: "fr",
  issueDate: todayIso(),
  workDate: todayIso(),
  dueDate: todayIso(),
  validUntil: todayIso(),
  lines: [],
  globalDiscountPercent: 0,
  depositPercent: 0,
  deductions: [],
  retentionPercent: 0,
  billingMode: "forfait",
  milestones: [],
  notes: "",
  sourceId: null,
  isAmendment: false,
  template: null,
  signature: null,
  sends: [],
  payments: [],
  structuredComm: "",
  peppol: { status: "none" },
  dispute: { active: false, note: "" },
  lockedAt: null,
  ...p,
});

export const newArticle = (p: Partial<Article> = {}): Article => ({
  id: uid(),
  ref: "",
  name: { fr: "", nl: "", de: "" },
  description: "",
  family: "",
  trade: "",
  type: "supply",
  unit: "u",
  purchasePrice: 0,
  marginPercent: 30,
  salePrice: 0,
  salePriceForced: false,
  category: "installed_material",
  supplierId: null,
  supplierRef: "",
  ean: "",
  notes: "",
  active: true,
  components: [],
  related: [],
  priceHistory: [],
  minStock: 0,
  ...p,
});

/** Numérotation chronologique continue, sans trou, par série et par année : F-2026-0001… */
export function nextNumber(settings: Settings, series: keyof Settings["prefixes"], year = new Date().getFullYear()) {
  const key = `${settings.prefixes[series]}-${year}`;
  const n = (settings.counters[key] ?? 0) + 1;
  return { number: `${key}-${String(n).padStart(4, "0")}`, counters: { ...settings.counters, [key]: n } };
}
