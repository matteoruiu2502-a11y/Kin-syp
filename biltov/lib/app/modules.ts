// Schémas des modules complémentaires (inspirés d'Odoo / Vertuoza, adaptés au bâtiment belge).
// Chaque module stocke des GenericRecord ; l'interface est générée à partir de ce schéma.

import type { ModuleId } from "./types";

export type FieldType = "text" | "textarea" | "number" | "money" | "date" | "select" | "bool" | "rating";
export type ModuleField = { key: string; label: string; type: FieldType; options?: string[]; list?: boolean };
export type ModuleSchema = {
  title: string; // libellé du champ « titre »
  statuses: { id: string; label: string; tone: "info" | "warn" | "ok" | "muted" }[];
  fields: ModuleField[];
  links: ("job" | "client" | "member" | "supplier" | "article")[];
  due?: string; // champ date qui déclenche une alerte
};

export const MODULE_SCHEMAS: Partial<Record<ModuleId, ModuleSchema>> = {
  helpdesk: {
    title: "Objet de la réclamation",
    statuses: [
      { id: "open", label: "Ouvert", tone: "warn" },
      { id: "in_progress", label: "En cours", tone: "info" },
      { id: "resolved", label: "Résolu", tone: "ok" },
    ],
    fields: [
      { key: "priority", label: "Priorité", type: "select", options: ["Basse", "Normale", "Haute", "Urgente"], list: true },
      { key: "deadline", label: "À traiter pour", type: "date", list: true },
      { key: "warranty", label: "Sous garantie", type: "bool" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "resolution", label: "Solution apportée", type: "textarea" },
    ],
    links: ["client", "job", "member"],
    due: "deadline",
  },
  rentals: {
    title: "Matériel loué",
    statuses: [
      { id: "booked", label: "Réservé", tone: "info" },
      { id: "out", label: "Sur chantier", tone: "warn" },
      { id: "returned", label: "Rendu", tone: "ok" },
    ],
    fields: [
      { key: "from", label: "Du", type: "date", list: true },
      { key: "to", label: "Au", type: "date", list: true },
      { key: "dailyRate", label: "Prix par jour (HTVA)", type: "money" },
      { key: "cost", label: "Coût total (HTVA)", type: "money", list: true },
      { key: "billTo", label: "Refacturé", type: "select", options: ["client", "interne"] },
      { key: "renter", label: "Loueur", type: "text" },
    ],
    links: ["job", "supplier"],
    due: "to",
  },
  maintenance: {
    title: "Machine / outillage",
    statuses: [
      { id: "planned", label: "Planifié", tone: "info" },
      { id: "done", label: "Fait", tone: "ok" },
      { id: "broken", label: "En panne", tone: "warn" },
    ],
    fields: [
      { key: "due", label: "Échéance", type: "date", list: true },
      { key: "serial", label: "N° de série", type: "text" },
      { key: "cost", label: "Coût (HTVA)", type: "money", list: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    links: ["member"],
    due: "due",
  },
  recruitment: {
    title: "Candidat",
    statuses: [
      { id: "new", label: "Nouveau", tone: "info" },
      { id: "interview", label: "Entretien", tone: "warn" },
      { id: "offer", label: "Offre", tone: "warn" },
      { id: "hired", label: "Engagé", tone: "ok" },
      { id: "refused", label: "Refusé", tone: "muted" },
    ],
    fields: [
      { key: "position", label: "Poste", type: "text", list: true },
      { key: "phone", label: "Téléphone", type: "text" },
      { key: "email", label: "E-mail", type: "text" },
      { key: "interview", label: "Date d'entretien", type: "date", list: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
    links: [],
  },
  knowledge: {
    title: "Titre de la fiche",
    statuses: [
      { id: "draft", label: "Brouillon", tone: "muted" },
      { id: "published", label: "Publiée", tone: "ok" },
    ],
    fields: [
      { key: "category", label: "Catégorie", type: "select", options: ["Procédure", "Check-list", "Fiche technique", "Sécurité", "Autre"], list: true },
      { key: "content", label: "Contenu", type: "textarea" },
    ],
    links: [],
  },
  surveys: {
    title: "Enquête",
    statuses: [
      { id: "draft", label: "À envoyer", tone: "muted" },
      { id: "sent", label: "Envoyée", tone: "info" },
      { id: "answered", label: "Répondue", tone: "ok" },
    ],
    fields: [
      { key: "score", label: "Note globale", type: "rating", list: true },
      { key: "recommend", label: "Nous recommanderait", type: "bool" },
      { key: "comment", label: "Commentaire du client", type: "textarea" },
    ],
    links: ["client", "job"],
  },
  marketing: {
    title: "Nom de la campagne",
    statuses: [
      { id: "draft", label: "Brouillon", tone: "muted" },
      { id: "sent", label: "Envoyée", tone: "ok" },
    ],
    fields: [
      { key: "channel", label: "Canal", type: "select", options: ["E-mail", "SMS", "WhatsApp"], list: true },
      { key: "tag", label: "Clients avec l'étiquette (vide = tous)", type: "text" },
      { key: "message", label: "Message", type: "textarea" },
    ],
    links: [],
  },
  subnetwork: {
    title: "Demande au sous-traitant",
    statuses: [
      { id: "requested", label: "Demandé", tone: "info" },
      { id: "accepted", label: "Accepté", tone: "ok" },
      { id: "declined", label: "Décliné", tone: "muted" },
      { id: "done", label: "Terminé", tone: "ok" },
    ],
    fields: [
      { key: "needed", label: "Pour le", type: "date", list: true },
      { key: "amount", label: "Prix convenu (HTVA)", type: "money", list: true },
      { key: "scope", label: "Travaux demandés", type: "textarea" },
    ],
    links: ["supplier", "job"],
    due: "needed",
  },
  manufacturing: {
    title: "Ordre de fabrication",
    statuses: [
      { id: "planned", label: "Planifié", tone: "info" },
      { id: "in_progress", label: "En cours", tone: "warn" },
      { id: "done", label: "Terminé", tone: "ok" },
    ],
    fields: [
      { key: "qty", label: "Quantité à produire", type: "number", list: true },
      { key: "due", label: "Pour le", type: "date", list: true },
      { key: "notes", label: "Notes d'atelier", type: "textarea" },
    ],
    links: ["article", "job", "member"],
    due: "due",
  },
};

/** Texte d'une campagne pour un client : {client} → nom. */
export const campaignText = (message: string, clientName: string) => message.replace(/\{client\}/g, clientName);

/** Destinataires d'une campagne : uniquement les clients ayant donné leur consentement (RGPD). */
export function campaignRecipients<T extends { marketingConsent: boolean; tags: string[]; email: string; phone: string }>(clients: T[], tag: string, channel: string) {
  return clients.filter((c) => c.marketingConsent && (!tag || c.tags.map((x) => x.toLowerCase()).includes(tag.toLowerCase())) && (channel === "E-mail" ? !!c.email : !!c.phone));
}
