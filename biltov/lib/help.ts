// Ouverture du chat d'aide depuis n'importe quel bouton du site (événement global).
export const HELP_EVENT = "biltov:help";

export function openHelp(question?: string) {
  window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: { question } }));
}

/** Adresse du support (à définir dans NEXT_PUBLIC_SUPPORT_EMAIL). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
