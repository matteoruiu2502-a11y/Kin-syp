import { describe, expect, it } from "vitest";
import { createsCycle, criticalPath, durationOf, endFrom, endGap, phasesFromTemplate, plannedEnd, propagate, shiftForWeather, taskAlerts, tasksFromQuote, newTask } from "./schedule";
import { emptyAccountData, newDoc, newJob, newLine } from "./defaults";
import type { Task } from "./types";

const cal = { constructionLeaves: [], hoursPerDay: 8, workdaysOnly: true };
const job = newJob({ id: "j", clientId: "c", startDate: "2026-10-05", endDate: "2026-10-30", memberIds: ["k"] });

const chain = (): Task[] => {
  const a = newTask({ id: "a", jobId: "j", name: "Gros œuvre", start: "2026-10-05", end: "2026-10-09" });
  const b = newTask({ id: "b", jobId: "j", name: "Toiture", start: "2026-10-12", end: "2026-10-14", deps: [{ taskId: "a", type: "FS", lag: 0 }] });
  const c = newTask({ id: "c", jobId: "j", name: "Électricité", start: "2026-10-12", end: "2026-10-16", deps: [{ taskId: "a", type: "SS", lag: 5 }] });
  const r = newTask({ id: "r", jobId: "j", name: "Réception", kind: "milestone", start: "2026-10-19", end: "2026-10-19", deps: [{ taskId: "b", type: "FS", lag: 0 }, { taskId: "c", type: "FS", lag: 0 }] });
  return [a, b, c, r];
};

describe("planning d'un chantier", () => {
  it("compte les durées en jours ouvrables", () => {
    expect(durationOf({ start: "2026-10-09", end: "2026-10-12" }, cal)).toBe(2); // vendredi → lundi
    expect(endFrom("2026-10-09", 3, cal)).toBe("2026-10-13");
    expect(endFrom("2026-11-10", 2, cal)).toBe("2026-11-12"); // saute l'Armistice
    expect(endFrom("2026-10-10", 1, cal)).toBe("2026-10-12"); // samedi → lundi
  });
  it("déplacer une tâche entraîne ses dépendantes ; la fin du chantier suit", () => {
    const before = chain();
    expect(plannedEnd(before)).toBe("2026-10-19");
    // le gros œuvre prend 3 jours de retard (fin le mercredi suivant)
    const moved = before.map((t) => (t.id === "a" ? { ...t, start: "2026-10-08", end: "2026-10-14" } : t));
    const after = propagate(before, moved, cal);
    const by = (id: string) => after.find((t) => t.id === id)!;
    expect([by("b").start, by("b").end]).toEqual(["2026-10-15", "2026-10-19"]); // durée conservée (3 j)
    expect([by("c").start, by("c").end]).toEqual(["2026-10-15", "2026-10-21"]); // début→début + 5 j
    expect(by("r").start).toBe("2026-10-22");
    expect(plannedEnd(after)).toBe("2026-10-22");
    // et si le gros œuvre avance, les tâches collées à leur contrainte reviennent aussi
    const back = propagate(after, after.map((t) => (t.id === "a" ? { ...t, start: "2026-10-05", end: "2026-10-09" } : t)), cal);
    expect(back.find((t) => t.id === "b")!.start).toBe("2026-10-12");
  });
  it("refuse les boucles et trouve le chemin critique", () => {
    const t = chain();
    expect(createsCycle(t, "a", "r")).toBe(true); // a dépendrait de r qui dépend (indirectement) de a
    expect(createsCycle(t, "r", "a")).toBe(false);
    const crit = criticalPath(t, cal);
    expect([...crit].sort()).toEqual(["a", "c", "r"]); // la toiture a 2 jours de marge
  });
  it("modèle de phases enchaînées, écart avec la fin contractuelle", () => {
    const p = phasesFromTemplate(job, cal, ["Gros œuvre", "Toiture", "Réception du chantier"]);
    expect(p.map((x) => [x.name, x.start, x.end])).toEqual([
      ["Gros œuvre", "2026-10-05", "2026-10-23"],
      ["Toiture", "2026-10-26", "2026-11-04"], // 8 j ouvrables, sans la Toussaint
      ["Réception du chantier", "2026-11-05", "2026-11-05"],
    ]);
    expect(endGap("2026-11-05", "2026-10-30", cal)).toBe(4);
    expect(endGap("2026-10-28", "2026-10-30", cal)).toBe(-2);
  });
  it("crée les tâches depuis un devis (sections, main-d'œuvre, sous-traitance)", () => {
    const doc = newDoc({ jobId: "j", clientId: "c", type: "quote" });
    doc.lines = [
      newLine({ kind: "section", label: "Salle de bain" }),
      newLine({ label: "Carrelage", qty: 20, unit: "m²" }),
      newLine({ label: "Main-d'œuvre carreleur", qty: 24, unit: "h" }),
      newLine({ label: "Électricité", qty: 1, unit: "forfait", executedBy: "sub1" }),
      newLine({ kind: "section", label: "Peinture" }),
      newLine({ label: "Peintre", qty: 2, unit: "j" }),
    ];
    const t = tasksFromQuote(doc, job, cal);
    // phase uniquement pour la section qui mêle nos équipes et un sous-traitant
    expect(t.filter((x) => x.kind === "phase").map((x) => x.name)).toEqual(["Salle de bain"]);
    const own = t.find((x) => x.name === "Salle de bain — nos équipes")!;
    expect([own.start, own.end]).toEqual(["2026-10-05", "2026-10-07"]); // 24 h / 8 h = 3 j
    const sub = t.find((x) => x.subcontractorId === "sub1")!;
    expect(sub.memberIds).toEqual([]);
    expect(sub.deps[0].taskId).toBe(own.id);
    expect(t.find((x) => x.name === "Peinture" && x.kind === "task")!.end).toBe("2026-10-13");
  });
  it("décale les tâches touchées par une intempérie", () => {
    const { tasks, moved } = shiftForWeather(chain(), { start: "2026-10-07", end: "2026-10-07" }, 1, cal);
    expect(tasks.find((t) => t.id === "a")!.end).toBe("2026-10-12");
    expect(tasks.find((t) => t.id === "b")!.start).toBe("2026-10-13");
    // la réception ne bouge pas : l'électricité, plus longue, la contraint toujours
    expect(moved.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });
  it("alerte : retard, dépendance cassée, stock insuffisant", () => {
    const d = emptyAccountData("");
    d.settings.planning = cal;
    d.articles = [{ id: "art", name: { fr: "Colle C2", nl: "", de: "" }, unit: "sac" } as never];
    d.stockMoves = [{ id: "m", articleId: "art", locationId: "depot", qty: 3, date: "2026-10-01", reason: "", jobId: null }];
    const t = chain();
    t[1] = { ...t[1], start: "2026-10-08", materials: [{ articleId: "art", qty: 5 }] };
    const alerts = taskAlerts(d, t, "2026-10-13");
    expect(alerts.some((a) => a.taskId === "a" && a.kind === "late")).toBe(true);
    expect(alerts.some((a) => a.taskId === "b" && a.kind === "dependency")).toBe(true);
    expect(alerts.find((a) => a.kind === "stock")?.text).toContain("3 / 5");
  });
});
