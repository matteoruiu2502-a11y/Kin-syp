// Libellés (en français, traduits à l'affichage par t()) et styles des statuts.

import type { ArticleType, ClientKind, DocStatus, JobStatus, LineCategory, ModuleId, Role, VatCode } from "./types";

export const JOB_STATUSES: JobStatus[] = ["lead", "draft", "sent", "accepted", "in_progress", "done", "refused", "lost"];
export const JOB_STATUS: Record<JobStatus, { label: string; style: string; color: string }> = {
  lead: { label: "Prospect", style: "bg-violet-500/15 text-violet-300 ring-violet-400/30", color: "#8b5cf6" },
  draft: { label: "Devis à faire", style: "bg-slate-500/15 text-slate-300 ring-slate-400/30", color: "#64748b" },
  sent: { label: "Devis envoyé", style: "bg-blue/15 text-sky-300 ring-blue/40", color: "#3b82ff" },
  accepted: { label: "Accepté", style: "bg-emerald/15 text-emerald ring-emerald/40", color: "#10b981" },
  in_progress: { label: "En cours", style: "bg-amber-400/15 text-amber-300 ring-amber-400/40", color: "#fbbf24" },
  done: { label: "Terminé", style: "bg-cyan/15 text-cyan ring-cyan/40", color: "#22d3ee" },
  refused: { label: "Refusé", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40", color: "#f43f5e" },
  lost: { label: "Perdu", style: "bg-rose-900/30 text-rose-300 ring-rose-800/40", color: "#9f1239" },
};

export const DOC_STATUS: Record<DocStatus, { label: string; style: string }> = {
  draft: { label: "Brouillon", style: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  sent: { label: "Envoyé", style: "bg-blue/15 text-sky-300 ring-blue/40" },
  viewed: { label: "Vu", style: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/40" },
  accepted: { label: "Signé", style: "bg-emerald/15 text-emerald ring-emerald/40" },
  refused: { label: "Refusé", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
  expired: { label: "Expiré", style: "bg-slate-600/20 text-slate-400 ring-slate-500/30" },
  issued: { label: "À encaisser", style: "bg-amber-400/15 text-amber-300 ring-amber-400/40" },
  partial: { label: "Partiellement payée", style: "bg-orange-400/15 text-orange-300 ring-orange-400/40" },
  paid: { label: "Payée", style: "bg-emerald/15 text-emerald ring-emerald/40" },
  cancelled: { label: "Annulée (note de crédit)", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
};

export const CLIENT_KIND: Record<ClientKind, string> = {
  particulier: "Particulier",
  assujetti: "Assujetti belge (déclarations TVA)",
  franchise: "Assujetti en franchise",
  public: "Pouvoir public",
  etranger: "Client étranger",
};

export const CATEGORY: Record<LineCategory, string> = {
  labour: "Main-d'œuvre",
  installed_material: "Matériau posé",
  supply_only: "Fourniture seule",
  fossil_boiler_install: "Installation chaudière fossile",
  fossil_boiler_service: "Entretien / réparation chaudière",
  heat_pump: "Pompe à chaleur",
  garden_creation: "Aménagement de jardin",
  garden_maintenance: "Entretien de jardin",
  other: "Autre",
};

export const VAT_LABEL: Record<VatCode, string> = { "21": "21 %", "12": "12 %", "6": "6 %", "0": "0 %", exempt: "Exonéré", reverse: "Autoliquidation", franchise: "Franchise" };

export const ARTICLE_TYPE: Record<ArticleType, string> = { supply: "Fourniture", labour: "Main-d'œuvre", equipment: "Équipement / location", subcontract: "Sous-traitance", package: "Ouvrage / forfait" };

export const ROLE: Record<Role, string> = { owner: "Super admin", admin: "Administrateur", employee: "Employé", secretary: "Secrétaire", accountant: "Comptable", worker: "Ouvrier" };

export const UNITS = ["u", "m²", "m³", "ml", "h", "j", "forfait", "lot", "kg", "L", "km"];

export const MODULES: Record<ModuleId, { label: string; desc: string }> = {
  catalog: { label: "Catalogue", desc: "Articles, ouvrages, import Excel" },
  clients: { label: "Clients & CRM", desc: "Fiches, pipeline, opportunités" },
  planning: { label: "Planning", desc: "Équipes, chantiers, météo" },
  time: { label: "Pointage", desc: "Heures par chantier" },
  reports: { label: "Rapports & interventions", desc: "Bons signés sur place, contrats d'entretien" },
  purchases: { label: "Achats & sous-traitance", desc: "Commandes, factures fournisseurs, obligation de retenue" },
  stock: { label: "Stock", desc: "Dépôt et camionnettes" },
  fleet: { label: "Flotte", desc: "Véhicules, entretiens, contrôles" },
  rentals: { label: "Location de matériel", desc: "Échafaudages, machines" },
  maintenance: { label: "Maintenance outillage", desc: "Entretien des machines" },
  expenses: { label: "Notes de frais", desc: "Tickets, remboursements" },
  documents: { label: "Documents", desc: "Coffre-fort par chantier et client" },
  helpdesk: { label: "SAV / Helpdesk", desc: "Réclamations et tickets" },
  leaves: { label: "Congés", desc: "Demandes et validations d'absence" },
  recruitment: { label: "Recrutement", desc: "Offres et candidats" },
  knowledge: { label: "Connaissances", desc: "Procédures, fiches techniques, check-lists" },
  surveys: { label: "Enquêtes de satisfaction", desc: "Questionnaire en fin de chantier" },
  chat: { label: "Discussion", desc: "Messagerie interne par chantier" },
  appointments: { label: "Rendez-vous", desc: "Visites de chantier et métrés" },
  marketing: { label: "Campagnes", desc: "E-mail / SMS / WhatsApp avec consentement" },
  website: { label: "Mini-site vitrine", desc: "Page publique + demande de devis" },
  subnetwork: { label: "Réseau de sous-traitants", desc: "Carnet de sous-traitants et demandes" },
  manufacturing: { label: "Fabrication (atelier)", desc: "Nomenclatures et ordres de fabrication" },
};
