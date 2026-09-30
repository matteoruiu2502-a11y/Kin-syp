// Abonnement Biltov, sans serveur :
// - essai gratuit de 5 jours dès la création du compte (compte obligatoire, aucune carte demandée) ;
// - ensuite, abonnement via un « lien de paiement » Stripe (Payment Link) : carte et prélèvement
//   automatique sont gérés par Stripe (voir README).

export const PRICE_MONTHLY = 99; // € HTVA / mois
export const PRICE_YEARLY = 948; // € HTVA / an (79 € / mois, environ -20 %)
export const TRIAL_DAYS = 5;

const LINKS = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
  yearly: process.env.NEXT_PUBLIC_STRIPE_LINK_YEARLY || process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
};

export const DASHBOARD_PATH = "/tableau-de-bord/";

export const paymentConfigured = Boolean(LINKS.monthly);

/** Bouton « Essai gratuit » : création du compte dans l'espace artisan (pas de carte). */
export function trialHref() {
  return `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${DASHBOARD_PATH}`;
}

/** Lien de paiement Stripe pour s'abonner (null tant qu'il n'est pas configuré). */
export function subscribeHref(yearly = false) {
  return (yearly ? LINKS.yearly : LINKS.monthly) || null;
}

/** Jours d'essai restants depuis la création du compte (0 = essai terminé). */
export function trialDaysLeft(createdAt: string, now = Date.now()) {
  const used = (now - Date.parse(createdAt)) / 864e5;
  return Math.max(0, Math.ceil(TRIAL_DAYS - used));
}

// Stripe renvoie vers …/tableau-de-bord/?paiement=ok (URL de confirmation du lien de paiement).
const SUB_KEY = "biltov.subscription";

export function readSubscription(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("paiement") === "ok") {
      localStorage.setItem(SUB_KEY, "active");
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
    return localStorage.getItem(SUB_KEY) === "active";
  } catch {
    return false;
  }
}
