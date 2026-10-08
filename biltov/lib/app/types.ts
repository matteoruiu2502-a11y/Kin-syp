// Modèle de données de Biltov (Belgique). Toutes les collections d'un compte.

import type { TradeId } from "../content/fr";
import type { ClientKind, Lang, LineCategory, VatCode } from "../tax/belgium";

export type { ClientKind, Lang, LineCategory, VatCode };
export type ISODate = string;

export type LegalForm = "Personne physique" | "SRL" | "SA" | "SC" | "SComm" | "SNC" | "ASBL" | "Autre";
export const LEGAL_FORMS: LegalForm[] = ["Personne physique", "SRL", "SA", "SC", "SComm", "SNC", "ASBL", "Autre"];

export type Address = { street: string; postcode: string; city: string; country: string };
export const emptyAddress = (): Address => ({ street: "", postcode: "", city: "", country: "BE" });

export type Company = {
  name: string;
  owner: string;
  legalForm: LegalForm;
  address: Address;
  phone: string;
  email: string;
  website: string;
  bce: string; // numéro d'entreprise
  vatRegime: "normal" | "franchise";
  rpm: string; // « RPM Liège » (personnes morales)
  insurer: string;
  insurerContact: string;
  policyNumber: string;
  iban: string;
  bic: string;
  trade: TradeId;
  lang: Lang; // langue par défaut des documents
};

export type Branding = { color: string; logo: string | null };

export type ModuleId =
  | "catalog"
  | "clients"
  | "planning"
  | "time"
  | "reports"
  | "purchases"
  | "stock"
  | "fleet"
  | "rentals"
  | "maintenance"
  | "expenses"
  | "documents"
  | "helpdesk"
  | "leaves"
  | "recruitment"
  | "knowledge"
  | "surveys"
  | "chat"
  | "appointments"
  | "marketing"
  | "website"
  | "subnetwork"
  | "manufacturing";

export type ReminderTemplate = { subject: Record<Lang, string>; body: Record<Lang, string> };

/** Plan comptable (PCMN belge) utilisé pour les exports — modifiable dans les paramètres. */
export type AccountingSettings = {
  salesJournal: string; // « VEN »
  purchasesJournal: string; // « ACH »
  bankJournal: string; // « BNK »
  sales: string; // 700000
  customers: string; // 400000
  purchases: string; // 600000 (approvisionnements)
  subcontracting: string; // 604000 (sous-traitance)
  generalExpenses: string; // 610000
  suppliers: string; // 440000
  vatDue: string; // 451000
  vatDeductible: string; // 411000
  bank: string; // 550000
};

export type Settings = {
  quoteValidityDays: number;
  paymentTermsDays: number;
  depositPercent: number;
  prefixes: { quote: string; invoice: string; credit: string; proforma: string; order: string };
  counters: Record<string, number>; // « F-2026 » → dernier numéro émis (continu, sans trou)
  modules: Record<ModuleId, boolean>;
  reminderTemplates: ReminderTemplate[]; // 0 : 1er rappel (gratuit en B2C), 1 : relance, 2 : mise en demeure
  priceLists: PriceList[];
  retentionGuaranteePercent: number;
  terms: { b2c: string; b2b: string }; // conditions générales (texte libre de l'artisan)
  accounting: AccountingSettings;
  defaultMargins: { own: number; subcontract: number }; // marge par défaut : nos ouvriers / sous-traitance
  rolePermissions?: Partial<Record<AssignableRole, Partial<Permissions>>>; // droits par rôle modifiés par le super admin
  planning?: PlanningSettings;
};

/** Calendrier de travail : congés du bâtiment (variables chaque année, commission paritaire 124) et journée type. */
export type PlanningSettings = {
  constructionLeaves: { id: string; label: string; start: ISODate; end: ISODate }[];
  hoursPerDay: number; // heures perdues pour une journée complète d'intempérie
  workdaysOnly: boolean; // durées en jours ouvrables (sans week-ends, fériés ni congés)
};

export type PriceList = { id: string; name: string; discountPercent: number; familyDiscounts: Record<string, number> };

export type Client = {
  id: string;
  kind: ClientKind;
  name: string; // nom complet ou raison sociale
  contactName: string;
  bce: string; // numéro d'entreprise (assujettis)
  vatNumber: string;
  lang: Lang;
  email: string;
  phone: string;
  billing: Address;
  sites: (Address & { id: string; label: string })[];
  notes: string;
  tags: string[];
  priceListId: string | null;
  source: string; // origine du contact (bouche-à-oreille, site…)
  marketingConsent: boolean;
  peppolId: string; // 0208:BCE si inscrit
  createdAt: ISODate;
};

export type JobStatus = "lead" | "draft" | "sent" | "accepted" | "in_progress" | "done" | "refused" | "lost";

export type Job = {
  id: string;
  clientId: string;
  name: string;
  trade: TradeId;
  status: JobStatus;
  date: ISODate;
  siteId: string | null; // adresse de chantier du client (sinon adresse de facturation)
  siteAddress: string;
  workKind: "immobilier" | "livraison";
  privateHousing: boolean;
  firstOccupationYear: number | null;
  offPremises: boolean; // devis signé au domicile du consommateur
  startDate: ISODate;
  endDate: ISODate;
  memberIds: string[];
  notes: string;
  amount: number; // HTVA du devis de référence
  probability: number; // % de chance de signature (pipeline)
  salesRep: string;
  weatherSensitive: boolean;
  materialLinks?: Record<string, string>; // analyse matériaux : description achetée → matériau du devis (ou « __none »)
  geo?: { lat: number; lng: number; label: string } | null; // localisation du chantier (météo historique)
  contractEndDate?: ISODate | null; // date de fin contractuelle (pénalités de retard)
};

export type LineKind = "item" | "section" | "text";

export type Line = {
  id: string;
  kind: LineKind;
  articleId: string | null;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number; // HTVA
  discountPercent: number;
  category: LineCategory;
  vat: VatCode;
  vatOverridden: boolean;
  optional: boolean; // option proposée au client
  selected: boolean; // option retenue
  toPrice: boolean; // « à chiffrer » (introuvable au catalogue)
  confidence: number | null; // correspondance catalogue lors de la dictée (0-1)
  costPrice: number; // prix de revient (rentabilité)
  progressPercent: number; // situations : avancement cumulé
  executedBy?: string | null; // null = notre société (nos ouvriers) ; sinon id du sous-traitant
  marginPercent?: number | null; // marge de la ligne sur le prix de revient : PU = coût × (1 + marge)
};

export type DocType = "quote" | "invoice" | "credit" | "proforma";
export type DocKind = "full" | "deposit" | "situation" | "final";
export type DocStatus = "draft" | "sent" | "viewed" | "accepted" | "refused" | "expired" | "issued" | "partial" | "paid" | "cancelled";
export type BillingMode = "forfait" | "regie" | "jalons";

export type SendLog = { at: string; channel: "email" | "whatsapp" | "sms" | "share" | "download" | "peppol" | "post"; kind: "document" | "reminder"; step?: number };
export type Payment = { id: string; date: ISODate; amount: number; method: string; reference: string };
export type Milestone = { id: string; label: string; percent: number; invoiced: boolean };

export type Doc = {
  id: string;
  jobId: string;
  clientId: string;
  type: DocType;
  kind: DocKind;
  number: string | null;
  version: number;
  previousId: string | null; // version précédente du devis
  status: DocStatus;
  lang: Lang;
  issueDate: ISODate;
  workDate: ISODate;
  dueDate: ISODate;
  validUntil: ISODate;
  lines: Line[];
  globalDiscountPercent: number;
  depositPercent: number;
  deductions: { label: string; amount: number; vat: VatCode }[]; // acomptes / situations déjà facturés (factures finales)
  retentionPercent: number; // retenue de garantie
  billingMode: BillingMode;
  milestones: Milestone[];
  notes: string;
  sourceId: string | null; // devis d'origine / facture annulée par la note de crédit
  isAmendment: boolean; // avenant / travaux supplémentaires
  template: string | null; // nom si modèle réutilisable
  signature: { image: string; name: string; at: string } | null;
  sends: SendLog[];
  payments: Payment[];
  structuredComm: string;
  peppol: { status: "none" | "ready" | "sent" | "delivered" | "error"; at?: string; message?: string };
  dispute: { active: boolean; note: string; since?: ISODate };
  lockedAt: string | null;
};

export type ArticleType = "supply" | "labour" | "equipment" | "subcontract" | "package";

export type Article = {
  id: string;
  ref: string;
  name: Record<Lang, string>;
  description: string;
  family: string;
  trade: TradeId | "";
  type: ArticleType;
  unit: string;
  purchasePrice: number;
  marginPercent: number;
  salePrice: number;
  salePriceForced: boolean;
  category: LineCategory;
  supplierId: string | null;
  supplierRef: string;
  ean: string;
  notes: string;
  active: boolean;
  components: { articleId: string; qty: number }[]; // ouvrage composé
  related: string[]; // ouvrages liés suggérés
  priceHistory: { at: ISODate; purchase: number; sale: number }[];
  minStock: number;
};

export type SupplierKind = "supplier" | "subcontractor";

export type AttestationKind = "insurance_rc" | "insurance_decennial" | "onss" | "tax" | "registration" | "other";
export type Attestation = { id: string; kind: AttestationKind; reference: string; validUntil: ISODate | null; fileId: string | null };
export type Supplier = {
  id: string;
  kind: SupplierKind;
  name: string;
  bce: string;
  email: string;
  phone: string;
  address: Address;
  trade: TradeId | "";
  importMapping: Record<string, string> | null; // profil d'import mémorisé
  notes: string;
  vatNumber?: string;
  iban?: string;
  attestations?: Attestation[];
  retentionChecks?: RetentionCheck[]; // historique des consultations « obligation de retenue »
  marginPercent?: number | null; // marge par défaut des lignes confiées à ce sous-traitant
};

export type RetentionCheck = { checkedAt: ISODate; taxDebt: boolean; onssDebt: boolean; inastiDebt: boolean; attestationId: string | null };

/** Commande : brouillon → commandé → en préparation → livré sur chantier → vérifié. Facture : à payer → payé. */
export type PurchaseStatus = "draft" | "ordered" | "preparing" | "delivered" | "verified" | "received" | "to_pay" | "paid";
export type PurchaseType = "order" | "delivery" | "invoice";
export type Purchase = {
  id: string;
  type: PurchaseType;
  supplierId: string;
  jobId: string | null;
  number: string;
  date: ISODate;
  dueDate: ISODate;
  lines: { id: string; articleId: string | null; label: string; qty: number; unitPrice: number; vat: number }[];
  status: PurchaseStatus;
  source: "manual" | "ocr" | "peppol";
  retention: RetentionCheck | null;
  paidAt: ISODate | null;
  fileId: string | null;
  orderId?: string | null; // bon de commande d'origine (bon de livraison, facture)
  iban?: string;
  structuredComm?: string;
};

export type Expense = { id: string; jobId: string | null; memberId: string | null; date: ISODate; supplier: string; label: string; amountTTC: number; vat: number; receiptId: string | null; reimbursable: boolean; status: "draft" | "submitted" | "approved" | "reimbursed" };

export type PhotoPhase = "avant" | "pendant" | "apres";
export type Geo = { lat: number; lng: number; accuracy: number };
export type Photo = { id: string; jobId: string; phase: PhotoPhase; caption: string; takenAt: string; addedAt: string; width: number; height: number; geo?: Geo | null };

/** « owner » = super admin : le titulaire du compte, unique, non attribuable et non supprimable. */
export type Role = "owner" | "admin" | "employee" | "worker" | "accountant" | "secretary";
export type AssignableRole = Exclude<Role, "owner">;

/** Modules soumis aux droits d'accès. */
export type PermModule =
  | "money"
  | "jobs"
  | "profit"
  | "clients"
  | "quotes"
  | "invoices"
  | "catalog"
  | "planning"
  | "team"
  | "time"
  | "worker"
  | "purchases"
  | "subcontractors"
  | "stock"
  | "fleet"
  | "tools"
  | "contracts"
  | "bank"
  | "accounting"
  | "modules"
  | "settings";
export type Access = "none" | "read" | "edit";
export type Permissions = Record<PermModule, Access>;

export type Member = {
  id: string;
  name: string;
  role: Role;
  phone: string;
  email: string;
  lang: Lang;
  hourlyCost: number;
  color: string;
  pin: string;
  active: boolean;
  permissions?: Partial<Permissions> | null; // exceptions propres à cette personne (sinon : droits du rôle)
};

export type TimeEntry = { id: string; memberId: string; jobId: string; date: ISODate; start: string; end: string; hours: number; note: string; geoStart?: Geo | null; geoEnd?: Geo | null };

export type EventKind = "job" | "visit" | "appointment" | "leave" | "maintenance";
export type PlanningEvent = { id: string; kind: EventKind; title: string; jobId: string | null; clientId: string | null; memberIds: string[]; vehicleIds?: string[]; start: string; end: string; notes: string; status: "planned" | "done" | "cancelled" | "requested" | "approved" | "refused" };

export type Report = {
  id: string;
  jobId: string;
  kind: "intervention" | "daily" | "reception" | "maintenance";
  date: ISODate;
  memberIds: string[];
  checklist: { label: string; done: boolean }[];
  notes: string;
  photoIds: string[];
  hours: number;
  materials: { label: string; qty: number; unit: string }[];
  signature: { image: string; name: string; at: string } | null;
  sentAt: string | null;
};

export type StockLocation = { id: string; name: string; kind: "depot" | "vehicle"; vehicleId: string | null };
export type StockMove = { id: string; articleId: string; locationId: string; qty: number; date: ISODate; reason: string; jobId: string | null };

export type Vehicle = { id: string; plate: string; model: string; memberId: string | null; nextInspection: ISODate; nextService: ISODate; mileage: number; costs: { date: ISODate; label: string; amount: number; jobId: string | null }[] };

/** Mouvement bancaire importé (CODA, Ponto) et son lettrage. */
export type BankMatch = { kind: "invoice" | "purchase"; id: string; amount: number };
export type BankMoveStatus = "unmatched" | "matched" | "partial" | "surplus" | "ignored";
export type BankMove = {
  id: string;
  date: ISODate;
  amount: number; // positif = crédit, négatif = débit
  communication: string;
  structured: boolean;
  counterparty: string;
  account: string;
  ref: string;
  source: "coda" | "ponto" | "manual";
  importedAt: string;
  matches: BankMatch[];
  status: BankMoveStatus;
  note: string;
};

/** Parc d'outils et de machines, avec affectation et historique. */
export type ToolAssignment = { type: "depot" | "vehicle" | "member" | "job"; id: string | null };
export type Tool = {
  id: string;
  name: string;
  category: string;
  serial: string;
  purchaseDate: ISODate | null;
  value: number;
  assignment: ToolAssignment;
  history: { at: string; assignment: ToolAssignment; note: string }[];
  serviceIntervalDays: number | null;
  lastService: ISODate | null;
  status: "ok" | "repair" | "lost" | "retired";
  notes: string;
};

/** Contrat d'entretien récurrent (tonte, taille, entretien chaudière…). */
export type ContractFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type Contract = {
  id: string;
  clientId: string;
  jobId: string | null;
  title: string;
  frequency: ContractFrequency;
  startDate: ISODate;
  nextDate: ISODate;
  endDate: ISODate | null;
  lines: { label: string; qty: number; unit: string; unitPrice: number; category: LineCategory }[];
  memberIds: string[];
  active: boolean;
  history: { date: ISODate; invoiceId: string | null; eventId: string | null }[];
};

/** Enregistrements génériques des modules complémentaires (SAV, congés, recrutement…). */
export type GenericRecord = { id: string; module: ModuleId; title: string; status: string; fields: Record<string, string | number | boolean>; jobId: string | null; clientId: string | null; memberId: string | null; createdAt: string; updatedAt: string };

// ── Intempéries ──────────────────────────────────────────────────────────────

export type WeatherKind = "rain" | "heavy_rain" | "storm" | "frost" | "snow" | "ice" | "wind" | "heat" | "fog" | "other";
export type WeatherImpact = "stop" | "slowed" | "indoor";
export type WeatherDuration = "full" | "half" | "hours";
export type WeatherStatus = "draft" | "justified" | "validated";

/** Pièce justificative : fichier (capture, PDF, photo du bulletin IRM) ou lien vers la source. */
export type WeatherProof = {
  id: string;
  kind: "file" | "link";
  name: string;
  mime: string;
  size: number;
  sha256: string; // empreinte du fichier à l'ajout (montre qu'il n'a pas été modifié)
  url: string; // lien vers la source (IRM…)
  consultedAt: string; // date et heure de consultation de la source
  addedAt: string;
  addedBy: string;
};

export type WeatherDay = {
  id: string;
  jobIds: string[];
  start: ISODate;
  end: ISODate; // = start pour un seul jour
  kind: WeatherKind;
  duration: WeatherDuration;
  fromTime: string; // HH:MM si durée en heures
  toTime: string;
  impact: WeatherImpact;
  memberIds: string[]; // ouvriers impactés
  hoursLost: number; // calculé (modifiable)
  measures: { rainMm: number | null; tMin: number | null; tMax: number | null; windKmh: number | null; source: "manual" | "open-meteo" | "" };
  proofs: WeatherProof[]; // fichiers stockés sous « proof:<id> »
  photoIds: string[]; // photos du chantier (horodatées)
  comment: string;
  status: WeatherStatus;
  validatedBy: string | null;
  createdAt: string;
  createdBy: string; // nom de l'auteur
  createdById: string | null; // membre auteur (null = titulaire du compte)
  history: { at: string; user: string; action: string; detail: string }[]; // journal non effaçable des modifications
};

export type AuditEntry = { at: string; user: string; action: string; entity: string; entityId: string; detail: string };

export type AccountData = {
  version: 2;
  company: Company;
  branding: Branding;
  settings: Settings;
  clients: Client[];
  jobs: Job[];
  docs: Doc[];
  articles: Article[];
  suppliers: Supplier[];
  purchases: Purchase[];
  expenses: Expense[];
  photos: Photo[];
  members: Member[];
  timeEntries: TimeEntry[];
  events: PlanningEvent[];
  reports: Report[];
  stockLocations: StockLocation[];
  stockMoves: StockMove[];
  vehicles: Vehicle[];
  records: GenericRecord[];
  bankMoves: BankMove[];
  tools: Tool[];
  contracts: Contract[];
  weatherDays: WeatherDay[];
  audit: AuditEntry[];
};

export type CollectionKey = { [K in keyof AccountData]: AccountData[K] extends { id: string }[] ? K : never }[keyof AccountData];

export type Account = { id: string; email: string; salt: string; hash: string; createdAt: string };
