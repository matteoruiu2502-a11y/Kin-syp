// Rôles et droits d'accès. Le super admin (titulaire du compte) a tous les droits ; les autres
// utilisateurs ont, par module, aucun accès / lecture / modification (droits du rôle, modifiables,
// puis exceptions propres à la personne).
//
// `deniedWrites` est le contrôle central : le magasin de données (store.tsx) refuse toute écriture
// qui touche un module sans droit de modification. Les mêmes règles serviront aux règles d'accès
// de la base serveur (Supabase) lorsqu'elle sera branchée.

import type { Access, AccountData, AssignableRole, Member, PermModule, Permissions, Role, Settings } from "./types";

export const PERM_MODULES: PermModule[] = ["money", "jobs", "profit", "clients", "quotes", "invoices", "catalog", "planning", "team", "time", "worker", "purchases", "subcontractors", "stock", "fleet", "tools", "contracts", "bank", "accounting", "modules", "settings"];

export const PERM_LABEL: Record<PermModule, { label: string; desc: string }> = {
  money: { label: "Argent à recevoir", desc: "Tableau de bord, créances, trésorerie" },
  jobs: { label: "Chantiers", desc: "Fiches chantier, photos, rapports" },
  profit: { label: "Rentabilité", desc: "Coûts, marges, prix de revient" },
  clients: { label: "Clients", desc: "Fiches clients et pipeline" },
  quotes: { label: "Devis", desc: "Devis, avenants, signatures" },
  invoices: { label: "Factures", desc: "Factures, notes de crédit, paiements" },
  catalog: { label: "Catalogue", desc: "Articles, ouvrages, prix" },
  planning: { label: "Planning", desc: "Agenda des équipes et véhicules" },
  team: { label: "Employés", desc: "Fiches du personnel, notes de frais" },
  time: { label: "Pointage", desc: "Heures prestées de toute l'équipe" },
  worker: { label: "Espace ouvrier", desc: "Son planning, son pointage, ses photos et rapports" },
  purchases: { label: "Achats", desc: "Commandes, bons de livraison, factures fournisseurs" },
  subcontractors: { label: "Sous-traitants", desc: "Fiches, attestations, retenues" },
  stock: { label: "Stock", desc: "Dépôts, camionnettes, inventaire" },
  fleet: { label: "Flotte", desc: "Véhicules, entretiens" },
  tools: { label: "Outils", desc: "Parc d'outils et machines" },
  contracts: { label: "Contrats", desc: "Contrats d'entretien récurrents" },
  bank: { label: "Banque", desc: "Extraits CODA, lettrage" },
  accounting: { label: "Comptabilité", desc: "Écritures, exports comptables" },
  modules: { label: "Modules complémentaires", desc: "SAV, congés, location…" },
  settings: { label: "Paramètres", desc: "Entreprise, numérotation, TVA" },
};

/** Modules de consultation pure : « modification » n'a pas de sens. */
export const READ_ONLY_MODULES: PermModule[] = ["money", "profit"];

export const ASSIGNABLE_ROLES: AssignableRole[] = ["admin", "employee", "secretary", "accountant", "worker"];

export const ROLE_DESC: Record<Role, string> = {
  owner: "Super admin : tous les droits, gère les utilisateurs et leurs accès. Unique et non transférable.",
  admin: "Gère l'entreprise au quotidien. Ne peut pas gérer les utilisateurs ni leurs accès.",
  employee: "Conducteur de travaux / employé : chantiers, devis, planning, achats. Pas la comptabilité.",
  secretary: "Secrétariat : clients, devis, factures, planning, achats.",
  accountant: "Comptable : factures, achats, banque, comptabilité.",
  worker: "Ouvrier : uniquement son espace (planning, pointage, photos, rapports). Aucun prix.",
};

const all = (a: Access): Permissions => Object.fromEntries(PERM_MODULES.map((m) => [m, a])) as Permissions;

export const DEFAULT_PERMISSIONS: Record<AssignableRole, Permissions> = {
  admin: { ...all("edit"), worker: "none" },
  employee: { ...all("none"), jobs: "edit", clients: "edit", quotes: "edit", invoices: "read", catalog: "read", planning: "edit", team: "read", time: "edit", worker: "edit", purchases: "edit", subcontractors: "read", stock: "edit", fleet: "read", tools: "edit", contracts: "read", modules: "read" },
  secretary: { ...all("none"), money: "read", jobs: "edit", clients: "edit", quotes: "edit", invoices: "edit", catalog: "edit", planning: "edit", team: "read", time: "edit", purchases: "edit", subcontractors: "edit", stock: "read", fleet: "edit", tools: "read", contracts: "edit", bank: "read", modules: "edit" },
  accountant: { ...all("none"), money: "read", jobs: "read", profit: "read", clients: "read", quotes: "read", invoices: "edit", planning: "read", time: "read", purchases: "edit", subcontractors: "edit", bank: "edit", accounting: "edit" },
  worker: { ...all("none"), worker: "edit" },
};

const cap = (m: PermModule, a: Access): Access => (a === "edit" && READ_ONLY_MODULES.includes(m) ? "read" : a);

/** Droits d'un rôle (défauts modifiés par le super admin). */
export function rolePermissions(settings: Pick<Settings, "rolePermissions">, role: AssignableRole): Permissions {
  const custom = settings.rolePermissions?.[role] ?? {};
  return Object.fromEntries(PERM_MODULES.map((m) => [m, cap(m, custom[m] ?? DEFAULT_PERMISSIONS[role][m])])) as Permissions;
}

export const isSuperAdmin = (actor: Member | null) => !actor || actor.role === "owner";

/** Droits effectifs : super admin → tout ; sinon rôle puis exceptions de la personne. */
export function permissionsOf(settings: Pick<Settings, "rolePermissions">, actor: Member | null): Permissions {
  if (isSuperAdmin(actor)) return all("edit");
  const base = rolePermissions(settings, actor!.role as AssignableRole);
  const own = actor!.permissions ?? {};
  return Object.fromEntries(PERM_MODULES.map((m) => [m, cap(m, own[m] ?? base[m])])) as Permissions;
}

const RANK: Record<Access, number> = { none: 0, read: 1, edit: 2 };
export const allows = (p: Permissions, m: PermModule, need: Access = "read") => RANK[p[m]] >= RANK[need];

/** N'a accès qu'à son espace ouvrier : l'application s'ouvre directement sur cet espace. */
export const workerOnly = (p: Permissions) => p.worker !== "none" && PERM_MODULES.every((m) => m === "worker" || p[m] === "none");

/** Ancien rôle « Secrétariat » (office) → secrétaire. */
export function migrateRoles(d: AccountData): AccountData {
  if (!d.members.some((m) => (m.role as string) === "office")) return d;
  return { ...d, members: d.members.map((m) => ((m.role as string) === "office" ? { ...m, role: "secretary" } : m)) };
}

// ── Contrôle des écritures ───────────────────────────────────────────────────

/** « superadmin » : réservé au super admin, quels que soient les droits ; « admin » : administrateur ou super admin. */
type Need = PermModule[] | "superadmin" | "admin" | "free";
type Item = { id: string } & Record<string, unknown>;

const own = (item: Item, actor: Member) => item.memberId === actor.id || (Array.isArray(item.memberIds) && item.memberIds.length > 0 && (item.memberIds as string[]).every((x) => x === actor.id));

/** Modules (au moins un en modification) requis pour créer, modifier ou supprimer cet élément. */
function itemNeed(key: keyof AccountData, before: Item | undefined, after: Item | undefined, actor: Member): Need {
  const item = (after ?? before)!;
  const mine = own(item, actor) && (!before || own(before, actor));
  switch (key) {
    case "clients":
      return ["clients"];
    case "jobs":
      // montant et statut du chantier suivent le devis (modification, signature)
      if (before && after && changedKeys(before, after).every((k) => k === "materialLinks")) return ["jobs", "purchases"];
      return before && after && changedKeys(before, after).every((k) => k === "amount" || k === "status") ? ["jobs", "quotes"] : ["jobs"];
    case "docs":
      return item.type === "quote" ? ["quotes"] : ["invoices", "bank"];
    case "articles":
      return ["catalog"];
    case "suppliers":
      return item.kind === "subcontractor" ? ["subcontractors", "purchases"] : ["purchases", "subcontractors"];
    case "purchases":
      return ["purchases", "subcontractors", "bank"];
    case "expenses":
      return mine ? ["team", "worker", "purchases"] : ["team", "purchases"];
    case "photos":
      return ["jobs", "worker"];
    case "timeEntries":
      return mine ? ["time", "worker"] : ["time"];
    case "events":
      // demande de congé de l'ouvrier pour lui-même
      return mine && item.kind === "leave" && (item.status === "requested" || !before) ? ["planning", "worker"] : ["planning"];
    case "reports":
      return mine ? ["jobs", "worker"] : ["jobs"];
    case "stockLocations":
    case "stockMoves":
      return ["stock", "purchases"];
    case "vehicles":
      return ["fleet"];
    case "records":
      return mine ? ["modules", "worker", "tools"] : item.module === "rentals" || item.module === "maintenance" ? ["modules", "tools"] : ["modules"];
    case "bankMoves":
      return ["bank"];
    case "tools":
      return ["tools"];
    case "contracts":
      return ["contracts"];
    case "weatherDays": {
      // valider une intempérie (preuve vérifiée) : administrateur uniquement
      if (after?.status === "validated" && before?.status !== "validated") return "admin";
      // l'ouvrier déclare et complète ses propres intempéries tant qu'elles ne sont pas validées
      const mine = item.createdById === actor.id && (!before || (before.createdById === actor.id && before.status !== "validated"));
      return mine ? ["planning", "worker"] : ["planning"];
    }
    case "members": {
      // créer, supprimer, changer le rôle, le code PIN ou les droits : super admin uniquement
      if (!before || !after) return "superadmin";
      if (before.role !== after.role || before.pin !== after.pin || JSON.stringify(before.permissions ?? null) !== JSON.stringify(after.permissions ?? null)) return "superadmin";
      return ["team"];
    }
    default:
      return "free";
  }
}

const changedKeys = (a: Item, b: Item) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);

function changedItems(prev: Item[], next: Item[]) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const out: [Item | undefined, Item | undefined][] = [];
  for (const x of next) {
    const b = before.get(x.id);
    if (b !== x) out.push([b, x]);
    before.delete(x.id);
  }
  for (const b of before.values()) out.push([b, undefined]);
  return out;
}

export type Denied = PermModule | "users";

/**
 * Liste des droits manquants pour passer de `prev` à `next` (vide = autorisé).
 * Le journal d'audit et les compteurs de numérotation suivent l'opération qui les modifie.
 */
export function deniedWrites(prev: AccountData, next: AccountData, actor: Member | null): Denied[] {
  if (isSuperAdmin(actor)) return [];
  const p = permissionsOf(prev.settings, actor);
  const out = new Set<Denied>();
  const need = (n: Need) => {
    if (n === "free") return;
    if (n === "superadmin") out.add("users");
    else if (n === "admin") {
      if (actor!.role !== "admin" || !allows(p, "planning", "edit")) out.add("planning");
    }
    else if (!n.some((m) => allows(p, m, "edit"))) out.add(n[0]);
  };
  for (const key of Object.keys(next) as (keyof AccountData)[]) {
    if (prev[key] === next[key] || key === "audit" || key === "version") continue;
    if (key === "company" || key === "branding") need(["settings"]);
    else if (key === "settings") {
      for (const sk of Object.keys({ ...prev.settings, ...next.settings }) as (keyof Settings)[]) {
        if (prev.settings[sk] === next.settings[sk] || sk === "counters") continue;
        need(sk === "rolePermissions" ? "superadmin" : ["settings"]);
      }
    } else if (Array.isArray(next[key])) {
      for (const [b, a] of changedItems(prev[key] as unknown as Item[], next[key] as unknown as Item[])) need(itemNeed(key, b, a, actor!));
    }
  }
  return [...out];
}

export class PermissionError extends Error {
  constructor(public denied: Denied[]) {
    super(`permission:${denied.join(",")}`);
    this.name = "PermissionError";
  }
}

/** Documents visibles : devis selon le droit « Devis », le reste selon « Factures ». */
export const docVisible = (p: Permissions) => (d: { type: string }) => allows(p, d.type === "quote" ? "quotes" : "invoices");
