import { describe, expect, it } from "vitest";
import { assignments, findConflicts, jobProgress, jobState, overlaps, unscheduledJobs, weeklyLoad } from "./gantt";
import { emptyAccountData, newJob } from "./defaults";
import type { AccountData, Member, Task } from "./types";

const cal = { constructionLeaves: [], hoursPerDay: 8, workdaysOnly: true };
const member = (id: string, role: Member["role"] = "worker"): Member => ({ id, name: id, role, phone: "", email: "", lang: "fr", hourlyCost: 30, color: "", pin: "", active: true });
const task = (p: Partial<Task> & Pick<Task, "id" | "jobId" | "start" | "end">): Task => ({ parentId: null, kind: "task", name: p.id, progress: 0, ownerId: null, memberIds: [], vehicleIds: [], subcontractorId: null, status: "todo", notes: "", deps: [], materials: [], baseline: null, order: 0, sourceLineIds: [], ...p });

const data = (): AccountData => {
  const d = emptyAccountData("");
  d.settings.planning = cal;
  d.members = [member("karim"), member("piotr"), member("eva", "employee"), member("sec", "secretary")];
  d.jobs = [
    newJob({ id: "a", clientId: "c", name: "Dupont", status: "in_progress", startDate: "2026-10-05", endDate: "2026-10-16", memberIds: ["karim"] }),
    newJob({ id: "b", clientId: "c", name: "Martin", status: "accepted", startDate: "2026-10-12", endDate: "2026-10-23", memberIds: ["karim", "piotr"] }),
    newJob({ id: "c", clientId: "c", name: "Sans dates", status: "accepted" }),
    newJob({ id: "d", clientId: "c", name: "Devis", status: "sent", startDate: "2026-10-05", endDate: "2026-10-30", memberIds: ["karim"] }),
  ];
  return d;
};

describe("Gantt : conflits et charge", () => {
  it("signale le même ouvrier sur deux chantiers qui se chevauchent", () => {
    const d = data();
    const c = findConflicts(assignments(d, "2026-10-01", "2026-10-31"), cal);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ resource: "m:karim", from: "2026-10-12", to: "2026-10-16", jobIds: ["a", "b"] });
    expect(c[0].days).toHaveLength(5); // jours ouvrables seulement
    // un devis non signé n'entre pas dans le planning
    expect(c[0].jobIds).not.toContain("d");
    expect(overlaps(d.jobs.filter((j) => j.id !== "d")).get("a")).toEqual(["b"]);
  });
  it("les tâches remplacent l'équipe du chantier ; congé = conflit", () => {
    const d = data();
    d.tasks = [task({ id: "t1", jobId: "b", start: "2026-10-19", end: "2026-10-23", memberIds: ["karim"] })];
    let c = findConflicts(assignments(d, "2026-10-01", "2026-10-31"), cal);
    expect(c).toHaveLength(0); // Karim n'est sur Martin qu'à partir du 19, après Dupont
    d.events = [{ id: "e", kind: "leave", title: "Congé", jobId: null, clientId: null, memberIds: ["karim"], start: "2026-10-22T00:00", end: "2026-10-22T23:59", notes: "", status: "approved" }];
    c = findConflicts(assignments(d, "2026-10-01", "2026-10-31"), cal);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ from: "2026-10-22", jobIds: ["__leave", "b"] });
  });
  it("état, avancement et chantiers à planifier", () => {
    const d = data();
    const [a, b] = d.jobs;
    expect(jobState(d, a, "2026-10-20")).toBe("late");
    expect(jobState(d, b, "2026-10-08")).toBe("upcoming");
    expect(jobState(d, b, "2026-10-14")).toBe("ongoing");
    expect(jobState(d, { ...b, contractEndDate: "2026-10-20" }, "2026-10-14")).toBe("risk");
    d.tasks = [task({ id: "t1", jobId: "b", start: "2026-10-12", end: "2026-10-16", progress: 100, status: "done" }), task({ id: "t2", jobId: "b", start: "2026-10-19", end: "2026-10-23", progress: 0 })];
    expect(jobProgress(d, b)).toBe(50);
    expect(unscheduledJobs(d).map((j) => j.id)).toEqual(["c"]);
  });
  it("charge par semaine : besoin vs disponibles", () => {
    const d = data();
    const load = weeklyLoad(d, "2026-10-05", "2026-10-23");
    // disponibles : 2 ouvriers + 1 employé (la secrétaire ne compte pas)
    expect(load.map((w) => [w.week, w.needed, w.available])).toEqual([
      ["2026-10-05", 1, 3],
      ["2026-10-12", 2, 3],
      ["2026-10-19", 2, 3],
    ]);
  });
});
