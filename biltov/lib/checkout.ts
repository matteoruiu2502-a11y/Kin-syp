// Paiement par « liens de paiement » Stripe (Payment Links), sans serveur :
// l'essai d'1 jour, la carte obligatoire et le prélèvement automatique sont
// réglés dans Stripe, sur le lien lui-même (voir README).

const LINKS = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
  yearly: process.env.NEXT_PUBLIC_STRIPE_LINK_YEARLY || process.env.NEXT_PUBLIC_STRIPE_LINK_MONTHLY || "",
};

export const DASHBOARD_PATH = "/tableau-de-bord/";

export const paymentConfigured = Boolean(LINKS.monthly);

/** Où envoyer un clic « Essai gratuit » : Stripe si configuré, sinon le tableau de bord (démo). */
export function trialHref(yearly = false) {
  return (yearly ? LINKS.yearly : LINKS.monthly) || `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${DASHBOARD_PATH}`;
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
