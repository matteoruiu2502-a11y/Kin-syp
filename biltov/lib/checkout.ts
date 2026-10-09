// Liens vers l'espace artisan. Les forfaits, prix et l'essai sont dans lib/plans.ts ;
// le paiement passe par le serveur d'abonnement (server/, Stripe).

export const DASHBOARD_PATH = "/tableau-de-bord/";

/** Bouton « Essai gratuit » : création du compte dans l'espace artisan (pas de carte). */
export function trialHref() {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${DASHBOARD_PATH}`;
}
