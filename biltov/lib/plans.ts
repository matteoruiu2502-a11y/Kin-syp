// ─────────────────────────────────────────────────────────────────────────────
// FORFAITS BILTOV — FICHIER DE CONFIGURATION CENTRAL
// Prix, quotas, utilisateurs et modules de chaque forfait. Le site, l'application ET le serveur
// (server/) lisent ce fichier : modifiez un chiffre ici, il change partout.
// Prix en euros HORS TVA ; la TVA belge (VAT_RATE) est ajoutée à l'affichage TTC et sur les factures Stripe.
// ─────────────────────────────────────────────────────────────────────────────

import type { PermModule } from "./app/types";

export type PlanId = "starter" | "pro" | "max";
export type Cycle = "monthly" | "yearly";

/**
 * Fonctionnalités contrôlées par forfait : les modules de droits de l'application (PermModule)
 * + quelques fonctions précises à l'intérieur d'un module.
 */
export type Feature =
  | PermModule
  | "users" // plusieurs utilisateurs (rôles standards)
  | "customRoles" // droits personnalisés par rôle et par personne (super admin)
  | "gantt" // planning Gantt
  | "weather" // calendrier des intempéries
  | "materials" // analyse matériaux prévu / réel
  | "subcontractLines" // sous-traitance ligne par ligne dans les devis
  | "mode3d"; // mode 3D (bâtiment)

export type PlanConfig = {
  id: PlanId;
  name: string;
  /** prix HTVA par mois (paiement mensuel) */
  monthly: number;
  /** factures envoyées via Peppol incluses par mois */
  invoicesPerMonth: number;
  /** prix HTVA par facture au-delà du quota (null = envoi bloqué au quota) */
  overagePrice: number | null;
  /** nombre d'utilisateurs, titulaire compris (null = illimité) */
  maxUsers: number | null;
  features: Feature[];
};

/** TVA belge appliquée aux abonnements. */
export const VAT_RATE = 0.21;

/** Paiement annuel : nombre de mois offerts (« 2 mois offerts » → on paie 10 mois). */
export const YEARLY_FREE_MONTHS = 2;

/** Essai gratuit : toutes les fonctionnalités du forfait indiqué, avec un quota Peppol réduit. */
export const TRIAL = { days: 5, plan: "max" as PlanId, peppolInvoices: 5 };

/** Paiement échoué : jours d'accès complet avant le passage en lecture seule. */
export const GRACE_DAYS = 7;

/** Alertes d'usage du quota de factures (pourcentages). */
export const USAGE_ALERTS = [80, 100] as const;

/** Coût estimé d'une facture Peppol chez le prestataire (sert uniquement au contrôle de marge des tests). */
export const PEPPOL_COST_ESTIMATE = 0.25;

const STARTER: Feature[] = ["money", "jobs", "clients", "quotes", "invoices", "catalog", "bank", "accounting", "settings"];
const PRO: Feature[] = [...STARTER, "users", "stock", "purchases", "fleet", "tools", "contracts", "planning", "modules"];
const MAX: Feature[] = [...PRO, "team", "time", "worker", "subcontractors", "profit", "customRoles", "gantt", "weather", "materials", "subcontractLines", "mode3d"];

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: { id: "starter", name: "Starter", monthly: 29, invoicesPerMonth: 30, overagePrice: null, maxUsers: 1, features: STARTER },
  pro: { id: "pro", name: "Pro", monthly: 59, invoicesPerMonth: 100, overagePrice: null, maxUsers: 5, features: PRO },
  max: { id: "max", name: "Max", monthly: 99, invoicesPerMonth: 300, overagePrice: 0.4, maxUsers: null, features: MAX },
};

/** Ordre croissant des forfaits (mise à niveau = forfait suivant). */
export const PLAN_ORDER: PlanId[] = ["starter", "pro", "max"];

/** Forfait mis en avant sur la page Tarifs. */
export const HIGHLIGHTED_PLAN: PlanId = "pro";

// ── Calculs de prix (toujours à partir des chiffres ci-dessus) ───────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Prix HTVA d'une période : un mois, ou un an avec les mois offerts. */
export const priceHT = (plan: PlanId, cycle: Cycle) => (cycle === "monthly" ? PLANS[plan].monthly : PLANS[plan].monthly * (12 - YEARLY_FREE_MONTHS));

/** Prix HTVA ramené au mois (affichage « / mois » en annuel). */
export const monthlyEquivalentHT = (plan: PlanId, cycle: Cycle) => round2(priceHT(plan, cycle) / (cycle === "monthly" ? 1 : 12));

/** Prix TVAC d'une période. */
export const priceTTC = (plan: PlanId, cycle: Cycle) => round2(priceHT(plan, cycle) * (1 + VAT_RATE));

/** Forfait le moins cher qui contient une fonctionnalité. */
export const planFor = (feature: Feature): PlanId => PLAN_ORDER.find((p) => PLANS[p].features.includes(feature)) ?? "max";
