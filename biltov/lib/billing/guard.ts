// Contrôle des écritures selon le forfait (en plus des droits du rôle) : appelé par le magasin de données
// avant chaque enregistrement. Rien n'est jamais supprimé : on refuse seulement la modification.

import type { AccountData } from "../app/types";
import { deniedWrites } from "../app/permissions";
import { planFor, type Feature, type PlanId } from "../plans";
import { activeUsers, canAccess, capPermissions, type Entitlement } from "./entitlement";

export type PlanBlock = { kind: "readonly" } | { kind: "feature"; feature: Feature; plan: PlanId } | { kind: "users"; max: number };

/** Clés librement modifiables même en lecture seule (état de l'abonnement, journal). */
const FREE: (keyof AccountData)[] = ["billing", "audit"];

export function planBlock(prev: AccountData, next: AccountData, ent: Entitlement): PlanBlock | null {
  const changed = (Object.keys(next) as (keyof AccountData)[]).filter((k) => prev[k] !== next[k] && !FREE.includes(k));
  if (!changed.length) return null;
  if (ent.readOnly) return { kind: "readonly" };

  // utilisateurs : limite du forfait (seulement si le nombre augmente) et droits personnalisés (Max)
  const before = activeUsers(prev.members);
  const after = activeUsers(next.members);
  if (ent.maxUsers !== null && after > ent.maxUsers && after > before) return { kind: "users", max: ent.maxUsers };
  if (!canAccess(ent, "customRoles")) {
    const custom = (m: AccountData["members"][number]) => JSON.stringify(m.permissions && Object.keys(m.permissions).length ? m.permissions : null);
    const rolesChanged = JSON.stringify(prev.settings.rolePermissions ?? {}) !== JSON.stringify(next.settings.rolePermissions ?? {});
    const memberCustom = next.members.some((m) => custom(m) !== "null" && custom(m) !== custom(prev.members.find((x) => x.id === m.id) ?? { ...m, permissions: null }));
    if (rolesChanged || memberCustom) return { kind: "feature", feature: "customRoles", plan: planFor("customRoles") };
  }

  // modules : mêmes règles que les droits, avec les droits du titulaire limités par le forfait
  const missing = deniedWrites(prev, { ...next, members: prev.members }, null, (p) => capPermissions(p, ent));
  const mod = missing.find((m) => m !== "users");
  return mod ? { kind: "feature", feature: mod, plan: planFor(mod) } : null;
}
