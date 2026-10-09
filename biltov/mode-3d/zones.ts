// Déclaration des pièces du bâtiment. Ajouter une zone = ajouter une entrée à ZONES :
//   - targets : pages ouvertes (mêmes adresses que le menu, ex. "stock", "planning/gantt") ; la première
//     autorisée pour l'utilisateur est ouverte, les droits sont ceux du mode normal ;
//   - badge : fonction de badges.ts (ou null) ;
//   - area : emplacement au sol [x, z, largeur, profondeur] (le bâtiment fait 14 × 10, centré en 0) ;
//   - decor : mobilier généré dans scene.ts ("empty" pour une pièce vide) ;
//   - soon : module pas encore développé → zone grisée « Bientôt disponible ».

import type { Badge, BadgeCtx } from "./badges";
import { officeBadge, parkingBadge, planningBadge, stockBadge, timeBadge } from "./badges";

export type Decor = "racks" | "desks" | "lockers" | "board" | "parking" | "empty";

export type ZoneConfig = {
  id: string;
  name: string;
  description: string;
  targets: string[];
  badge: ((ctx: BadgeCtx) => Badge | null) | null;
  area: [x: number, z: number, w: number, d: number];
  decor: Decor;
  outdoor?: boolean;
  soon?: boolean;
};

export const ZONES: ZoneConfig[] = [
  { id: "entrepot", name: "Entrepôt", description: "Stock et catalogue de matériaux", targets: ["stock", "catalogue"], badge: stockBadge, area: [-7, -5, 7, 5], decor: "racks" },
  { id: "bureau", name: "Bureau", description: "Devis, factures et comptabilité", targets: ["documents", "comptabilite"], badge: officeBadge, area: [0, -5, 7, 5], decor: "desks" },
  { id: "pointage", name: "Pointage et vestiaire", description: "Pointage et ouvriers", targets: ["equipe", "mon-espace"], badge: timeBadge, area: [-7, 0, 7, 5], decor: "lockers" },
  { id: "planning", name: "Salle de planning", description: "Gantt et jours d'intempéries", targets: ["planning/gantt"], badge: planningBadge, area: [0, 0, 7, 5], decor: "board" },
  { id: "parking", name: "Parking", description: "Chantiers en cours", targets: ["chantiers"], badge: parkingBadge, area: [8.5, -5, 7, 10], decor: "parking", outdoor: true },
];

/** Accès à une page, calculé par l'espace artisan (droits + modules activés). */
export type PageAccess = "ok" | "locked" | "off";
export type ZoneAccess = PageAccess | "soon";
export type OpenTarget = string;

/** État d'une zone pour l'utilisateur : page à ouvrir si autorisée. */
export function resolveZone(z: ZoneConfig, access: (page: string) => PageAccess): { access: ZoneAccess; target: string | null } {
  if (z.soon) return { access: "soon", target: null };
  const states = z.targets.map((p) => [p, access(p.split("/")[0])] as const);
  const ok = states.find(([, a]) => a === "ok");
  if (ok) return { access: "ok", target: ok[0] };
  return { access: states.every(([, a]) => a === "off") ? "off" : "locked", target: null };
}
