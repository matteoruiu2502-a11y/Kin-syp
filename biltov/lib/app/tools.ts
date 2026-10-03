// Parc d'outils et de machines : affectation (dépôt, camionnette, ouvrier, chantier), historique, entretien.

import { addDays, nowIso, todayIso } from "./defaults";
import type { AccountData, Tool, ToolAssignment } from "./types";

export const nextService = (t: Tool) => (t.serviceIntervalDays && (t.lastService || t.purchaseDate) ? addDays((t.lastService || t.purchaseDate)!, t.serviceIntervalDays) : null);
export const serviceDue = (t: Tool, today = todayIso(), horizon = 14) => {
  const n = nextService(t);
  return !!n && n <= addDays(today, horizon) && t.status !== "retired";
};

export function assignTool(d: AccountData, toolId: string, assignment: ToolAssignment, note = ""): AccountData {
  return { ...d, tools: d.tools.map((t) => (t.id === toolId ? { ...t, assignment, history: [...t.history, { at: nowIso(), assignment, note }] } : t)) };
}

export function assignmentLabel(d: AccountData, a: ToolAssignment) {
  if (a.type === "depot") return "Dépôt";
  if (a.type === "vehicle") return d.vehicles.find((v) => v.id === a.id)?.plate ?? "Véhicule";
  if (a.type === "member") return d.members.find((m) => m.id === a.id)?.name ?? "Ouvrier";
  return d.jobs.find((j) => j.id === a.id)?.name ?? "Chantier";
}
