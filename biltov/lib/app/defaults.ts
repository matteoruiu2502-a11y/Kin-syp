import type { AccountData, Company, Doc, Job, Settings } from "./types";

export const uid = () => crypto.randomUUID().slice(0, 12);
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const emptyCompany = (email = ""): Company => ({
  name: "",
  owner: "",
  legalForm: "EI",
  capital: "",
  address: "",
  postcode: "",
  city: "",
  phone: "",
  email,
  siret: "",
  registry: "",
  vatNumber: "",
  vatMode: "normal",
  vatOnDebits: false,
  insurer: "",
  insurerContact: "",
  policyNumber: "",
  coverage: "France métropolitaine",
  mediatorName: "",
  mediatorUrl: "",
  iban: "",
  bic: "",
  trade: "plombier",
});

export const defaultSettings = (): Settings => ({
  quoteValidityDays: 30,
  paymentTermsDays: 30,
  depositPercent: 30,
  defaultVat: 10,
  quotePrefix: "D",
  invoicePrefix: "F",
  creditPrefix: "A",
  counters: {},
  freeQuote: true,
});

export const emptyAccountData = (email: string): AccountData => ({
  company: emptyCompany(email),
  branding: { color: "#0066FF", logo: null },
  settings: defaultSettings(),
  jobs: [],
  docs: [],
  photos: [],
  expenses: [],
});

export const newJob = (partial: Partial<Job> = {}): Job => ({
  id: uid(),
  name: "",
  trade: "plombier",
  status: "draft",
  date: todayIso(),
  notes: "",
  clientType: "particulier",
  client: "",
  clientAddress: "",
  clientEmail: "",
  clientPhone: "",
  clientSiren: "",
  siteAddress: "",
  city: "",
  startDate: "",
  duration: "",
  offPremises: false,
  reducedVatEligible: false,
  reverseCharge: false,
  amount: 0,
  ...partial,
});

export const newDoc = (partial: Partial<Doc> & Pick<Doc, "jobId" | "type">): Doc => ({
  id: uid(),
  number: null,
  status: "draft",
  issueDate: todayIso(),
  workDate: todayIso(),
  dueDate: todayIso(),
  validUntil: todayIso(),
  lines: [],
  depositPercent: 0,
  paidBefore: 0,
  kind: "full",
  notes: "",
  sourceId: null,
  signature: null,
  sends: [],
  paidAt: null,
  paymentMethod: "",
  lockedAt: null,
  ...partial,
});

/** Numérotation chronologique continue par type et par année : F-2026-0001, F-2026-0002… */
export function nextNumber(settings: Settings, type: Doc["type"], year = new Date().getFullYear()) {
  const prefix = type === "quote" ? settings.quotePrefix : type === "invoice" ? settings.invoicePrefix : settings.creditPrefix;
  const key = `${prefix}-${year}`;
  const n = (settings.counters[key] ?? 0) + 1;
  return { number: `${key}-${String(n).padStart(4, "0")}`, counters: { ...settings.counters, [key]: n } };
}
