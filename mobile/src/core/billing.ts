/**
 * Offre KinéSyP : 5 patients gratuits par compte praticien, puis abonnement
 * mensuel. Ces règles sont appliquées par le serveur (source de vérité) et
 * reprises par les applications pour l'affichage.
 */
export const FREE_PATIENT_LIMIT = 5;
export const SUBSCRIPTION_PRICE_EUR = 50;
export const SUBSCRIPTION_LABEL = `${SUBSCRIPTION_PRICE_EUR} € / mois`;

/** Statuts d'abonnement (alignés sur Stripe). */
export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

export interface Subscription {
  status: SubscriptionStatus;
  /** Fin de la période payée (ISO), si connue. */
  currentPeriodEnd: string | null;
  /** Résiliation programmée en fin de période. */
  cancelAtPeriodEnd: boolean;
}

export const NO_SUBSCRIPTION: Subscription = { status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false };

/** Délai de grâce après un échec de paiement, le temps que Stripe relance. */
export const PAST_DUE_GRACE_DAYS = 7;

export function isSubscriptionActive(sub: Subscription, now: Date = new Date()): boolean {
  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null;
  switch (sub.status) {
    case 'active':
    case 'trialing':
      return true;
    case 'past_due':
      return end !== null && now.getTime() <= end + PAST_DUE_GRACE_DAYS * 86_400_000;
    case 'canceled':
      // Résilié : l'accès reste ouvert jusqu'à la fin de la période déjà payée.
      return end !== null && now.getTime() <= end;
    default:
      return false;
  }
}

export interface Entitlement {
  subscribed: boolean;
  patientCount: number;
  /** null = illimité (abonné). */
  patientLimit: number | null;
  canCreatePatient: boolean;
  /** Patients gratuits restants (null si abonné). */
  remainingFree: number | null;
}

export function entitlement(sub: Subscription, patientCount: number, now: Date = new Date()): Entitlement {
  const subscribed = isSubscriptionActive(sub, now);
  if (subscribed) {
    return { subscribed, patientCount, patientLimit: null, canCreatePatient: true, remainingFree: null };
  }
  const remainingFree = Math.max(0, FREE_PATIENT_LIMIT - patientCount);
  return { subscribed, patientCount, patientLimit: FREE_PATIENT_LIMIT, canCreatePatient: remainingFree > 0, remainingFree };
}

/** Libellé court de l'offre pour l'interface. */
export function planLabel(e: Entitlement): string {
  if (e.subscribed) return `Abonnement actif · patients illimités`;
  return `Offre gratuite · ${e.patientCount}/${FREE_PATIENT_LIMIT} patients`;
}
