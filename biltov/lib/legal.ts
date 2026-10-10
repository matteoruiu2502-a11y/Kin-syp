// Identité de l'éditeur de Biltov, reprise dans les pages légales (mentions légales, conditions générales,
// confidentialité, cookies). Un champ vide s'affiche « [à compléter : …] » sur le site.
// Textes à faire relire par un juriste avant l'ouverture au public.

export const LEGAL = {
  /** Nom de la société (ou nom et prénom pour une personne physique) */
  company: "",
  /** Forme juridique : SRL, SA, personne physique… */
  legalForm: "",
  /** Adresse du siège */
  address: "",
  /** Numéro d'entreprise BCE (0xxx.xxx.xxx) */
  bce: "",
  /** Numéro de TVA (BE0xxx.xxx.xxx), si différent du BCE */
  vat: "",
  /** E-mail de contact */
  email: "",
  /** Téléphone (facultatif) */
  phone: "",
  /** Responsable de la publication */
  publisher: "",
  /** Arrondissement judiciaire compétent (celui du siège, ex. « Bruxelles ») */
  court: "",
  /** Région du projet Supabase (Supabase → Settings → General), ex. « Union européenne (Francfort) » */
  dataRegion: "",
  /** Date de la dernière mise à jour des textes */
  updated: "9 octobre 2026",
};

export type LegalField = keyof typeof LEGAL;

export const LEGAL_LABELS: Record<LegalField, string> = {
  company: "nom de la société",
  legalForm: "forme juridique",
  address: "adresse du siège",
  bce: "numéro d'entreprise",
  vat: "numéro de TVA",
  email: "e-mail de contact",
  phone: "téléphone",
  publisher: "responsable de la publication",
  court: "arrondissement judiciaire",
  dataRegion: "région d'hébergement des données",
  updated: "date de mise à jour",
};
