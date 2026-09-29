// Modèle de données de l'application Biltov (espace artisan).

import type { TradeId } from "../content/fr";

export type VatRate = 20 | 10 | 5.5 | 0;
export const VAT_RATES: VatRate[] = [20, 10, 5.5, 0];

export type LegalForm = "EI" | "EI (micro-entreprise)" | "EURL" | "SARL" | "SASU" | "SAS" | "SA" | "SCOP" | "Autre";
export const LEGAL_FORMS: LegalForm[] = ["EI", "EI (micro-entreprise)", "EURL", "SARL", "SASU", "SAS", "SA", "SCOP", "Autre"];

export type Company = {
  name: string; // raison sociale ou nom commercial
  owner: string; // dirigeant / entrepreneur
  legalForm: LegalForm;
  capital: string; // ex. « 10 000 € » (sociétés)
  address: string;
  postcode: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
  registry: string; // « RCS Lyon 912 345 678 » ou « RM 69 912 345 678 »
  vatNumber: string; // TVA intracommunautaire
  vatMode: "normal" | "franchise"; // franchise en base : art. 293 B du CGI
  vatOnDebits: boolean; // option pour le paiement de la TVA d'après les débits
  insurer: string; // assurance décennale / RC pro
  insurerContact: string;
  policyNumber: string;
  coverage: string; // couverture géographique
  mediatorName: string; // médiateur de la consommation (clients particuliers)
  mediatorUrl: string;
  iban: string;
  bic: string;
  trade: TradeId;
};

export type Branding = { color: string; logo: string | null /* data URL */ };

export type Settings = {
  quoteValidityDays: number;
  paymentTermsDays: number; // délai de paiement des factures
  depositPercent: number; // acompte proposé à la signature
  defaultVat: VatRate;
  quotePrefix: string;
  invoicePrefix: string;
  creditPrefix: string;
  counters: Record<string, number>; // « F-2026 » → dernier numéro émis
  freeQuote: boolean; // devis gratuit
};

export type ClientType = "particulier" | "professionnel";

export type JobStatus = "draft" | "sent" | "accepted" | "in_progress" | "done" | "refused";

export type Job = {
  id: string;
  name: string;
  trade: TradeId;
  status: JobStatus;
  date: string; // AAAA-MM-JJ (création / devis)
  notes: string;
  clientType: ClientType;
  client: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  clientSiren: string; // obligatoire sur les factures B2B (réforme facturation électronique)
  siteAddress: string; // adresse du chantier
  city: string;
  startDate: string;
  duration: string; // durée estimée des travaux
  offPremises: boolean; // contrat conclu hors établissement → droit de rétractation 14 j
  reducedVatEligible: boolean; // logement achevé depuis plus de 2 ans (TVA 10 % / 5,5 %)
  reverseCharge: boolean; // sous-traitance BTP : autoliquidation (art. 283-2 nonies CGI)
  amount: number; // montant HT indicatif (remplacé par le devis dès qu'il existe)
};

export type Line = { id: string; label: string; qty: number; unit: string; unitPrice: number; vat: VatRate };

export type DocType = "quote" | "invoice" | "credit";
export type DocStatus = "draft" | "sent" | "accepted" | "refused" | "issued" | "paid" | "cancelled";

export type SendLog = { at: string; channel: "email" | "whatsapp" | "sms" | "share" | "download"; kind: "document" | "reminder"; step?: number };

export type Doc = {
  id: string;
  jobId: string;
  type: DocType;
  number: string | null; // attribué à l'émission (facture) ou à la création (devis)
  status: DocStatus;
  issueDate: string;
  workDate: string; // date / période d'exécution (factures)
  dueDate: string; // échéance (factures)
  validUntil: string; // devis
  lines: Line[];
  depositPercent: number; // devis : acompte demandé
  paidBefore: number; // factures : acomptes déjà versés (TTC)
  kind: "full" | "deposit" | "balance"; // facture complète, d'acompte ou de solde
  notes: string;
  sourceId: string | null; // devis d'origine / facture annulée par l'avoir
  signature: { image: string; name: string; at: string } | null;
  sends: SendLog[];
  paidAt: string | null;
  paymentMethod: string;
  lockedAt: string | null; // facture émise : plus modifiable
};

export type PhotoPhase = "avant" | "pendant" | "apres";
export type Photo = { id: string; jobId: string; phase: PhotoPhase; caption: string; takenAt: string; addedAt: string; width: number; height: number };

export type Expense = { id: string; jobId: string; date: string; supplier: string; label: string; amountTTC: number; vat: VatRate; receiptId: string | null };

export type AccountData = {
  company: Company;
  branding: Branding;
  settings: Settings;
  jobs: Job[];
  docs: Doc[];
  photos: Photo[];
  expenses: Expense[];
};

export type Account = { id: string; email: string; salt: string; hash: string; createdAt: string };
