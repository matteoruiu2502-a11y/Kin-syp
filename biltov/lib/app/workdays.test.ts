import { describe, expect, it } from "vitest";
import { addWorkdays, belgianHolidays, dayOff, easter, isWorkday, workdaysIn } from "./workdays";
import { defaultPlanningSettings } from "./defaults";

describe("calendrier belge", () => {
  it("calcule Pâques", () => {
    expect(easter(2024)).toBe("2024-03-31");
    expect(easter(2025)).toBe("2025-04-20");
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });
  it("liste les 10 jours fériés légaux", () => {
    const h = belgianHolidays(2026);
    expect(h.size).toBe(10);
    expect(h.get("2026-04-06")).toBe("Lundi de Pâques");
    expect(h.get("2026-05-14")).toBe("Ascension");
    expect(h.get("2026-05-25")).toBe("Lundi de Pentecôte");
    expect(h.get("2026-07-21")).toBe("Fête nationale");
    expect(h.get("2026-11-11")).toBe("Armistice");
  });
  it("distingue week-end, férié et congé du bâtiment", () => {
    const cal = { constructionLeaves: [{ id: "x", label: "Congés d'été", start: "2026-07-13", end: "2026-07-31" }] };
    expect(dayOff("2026-10-10", cal)?.kind).toBe("weekend");
    expect(dayOff("2026-11-11", cal)?.kind).toBe("holiday");
    expect(dayOff("2026-07-15", cal)?.kind).toBe("leave");
    expect(dayOff("2026-10-07", cal)).toBeNull();
  });
  it("compte et ajoute des jours ouvrables", () => {
    const cal = { constructionLeaves: [] };
    expect(workdaysIn("2026-10-05", "2026-10-11", cal)).toHaveLength(5);
    expect(addWorkdays("2026-10-09", 1, cal)).toBe("2026-10-12"); // vendredi + 1 → lundi
    expect(addWorkdays("2026-11-10", 1, cal)).toBe("2026-11-12"); // saute l'Armistice
    expect(addWorkdays("2026-10-12", -1, cal)).toBe("2026-10-09");
    expect(isWorkday("2026-12-25", defaultPlanningSettings(2026))).toBe(false);
  });
});
