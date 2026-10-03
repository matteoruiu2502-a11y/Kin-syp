import { describe, expect, it } from "vitest";
import { emptyAccountData } from "./defaults";
import { badWeather, conflicts, mondayOf, onDay, toIcs, weekDays } from "./planning";
import type { PlanningEvent } from "./types";

const ev = (p: Partial<PlanningEvent>): PlanningEvent => ({ id: "e", kind: "job", title: "Pose", jobId: null, clientId: null, memberIds: ["m1"], start: "2026-09-30T08:00", end: "2026-09-30T16:00", notes: "", status: "planned", ...p });

describe("planning", () => {
  it("semaine du lundi", () => {
    expect(mondayOf("2026-09-30")).toBe("2026-09-28");
    expect(mondayOf("2026-09-28")).toBe("2026-09-28");
    expect(weekDays("2026-09-28")).toHaveLength(7);
    expect(weekDays("2026-09-28")[6]).toBe("2026-10-04");
  });
  it("événement sur plusieurs jours", () => {
    const e = ev({ end: "2026-10-02T16:00" });
    expect(onDay(e, "2026-10-01")).toBe(true);
    expect(onDay(e, "2026-10-03")).toBe(false);
  });
  it("détecte un conflit d'affectation, ignore les congés refusés", () => {
    const d = { ...emptyAccountData("a"), events: [ev({ id: "a" }), ev({ id: "b", kind: "leave", start: "2026-09-30T12:00", end: "2026-09-30T23:00" }), ev({ id: "c", status: "refused" })] };
    const c = conflicts(d, ev({ id: "new", start: "2026-09-30T13:00", end: "2026-09-30T17:00" }));
    expect(c.map((x) => x.event.id)).toEqual(["a", "b"]);
  });
  it("export iCalendar", () => {
    const ics = toIcs([ev({ title: "Pose, carrelage" })], emptyAccountData("a"));
    expect(ics).toContain("DTSTART:20260930T080000");
    expect(ics).toContain("SUMMARY:Pose\\, carrelage");
  });
  it("météo défavorable", () => {
    expect(badWeather({ date: "", code: 61, rain: 8, tmax: 12, wind: 10 })).toBe(true);
    expect(badWeather({ date: "", code: 1, rain: 0, tmax: 18, wind: 10 })).toBe(false);
  });
});

import { moveEvent } from "./planning";
describe("glisser-déposer", () => {
  it("déplace d'un jour et réaffecte l'ouvrier", () => {
    const e = { id: "e", kind: "job" as const, title: "x", jobId: null, clientId: null, memberIds: ["a", "b"], start: "2026-09-30T08:00", end: "2026-10-01T16:00", notes: "", status: "planned" as const };
    const m = moveEvent(e, { row: { type: "member", id: "a" }, day: "2026-09-30" }, { row: { type: "member", id: "c" }, day: "2026-10-02" });
    expect(m.start).toBe("2026-10-02T08:00");
    expect(m.end).toBe("2026-10-03T16:00");
    expect(m.memberIds).toEqual(["b", "c"]);
    const v = moveEvent(m, { row: { type: "none", id: "" }, day: "2026-10-02" }, { row: { type: "vehicle", id: "van" }, day: "2026-10-02" });
    expect(v.vehicleIds).toEqual(["van"]);
    expect(v.memberIds).toEqual(["b", "c"]);
  });
});
