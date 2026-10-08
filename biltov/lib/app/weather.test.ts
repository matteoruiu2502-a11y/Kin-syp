import { describe, expect, it } from "vitest";
import { aggregateDaily, computeHoursLost, delayDays, displayStatus, jobWeatherSummary, newWeatherDay, nextStatus, placeOf, weatherCsv } from "./weather";
import { emptyAccountData } from "./defaults";
import type { WeatherProof } from "./types";

const cal = { constructionLeaves: [], hoursPerDay: 8, workdaysOnly: true };
const proof: WeatherProof = { id: "p", kind: "file", name: "irm.png", mime: "image/png", size: 10, sha256: "ab", url: "", consultedAt: "", addedAt: "2026-10-01T10:00:00Z", addedBy: "Jean" };

describe("intempéries", () => {
  it("calcule les heures perdues selon durée, impact et ouvriers", () => {
    const base = newWeatherDay({ start: "2026-10-06", createdBy: "x", memberIds: ["a", "b"] });
    expect(computeHoursLost(base, cal)).toBe(16); // journée, arrêt, 2 ouvriers
    expect(computeHoursLost({ ...base, duration: "half" }, cal)).toBe(8);
    expect(computeHoursLost({ ...base, impact: "slowed" }, cal)).toBe(8);
    expect(computeHoursLost({ ...base, impact: "indoor" }, cal)).toBe(0);
    expect(computeHoursLost({ ...base, duration: "hours", fromTime: "13:00", toTime: "16:00" }, cal)).toBe(6);
    // du vendredi au lundi : 2 jours ouvrables
    expect(computeHoursLost({ ...base, start: "2026-10-09", end: "2026-10-12", memberIds: [] }, cal)).toBe(16);
  });
  it("signale les jours sans preuve « à justifier »", () => {
    const w = newWeatherDay({ start: "2026-10-06", createdBy: "x" });
    expect(displayStatus(w)).toBe("to_justify");
    expect(nextStatus({ ...w, proofs: [proof] })).toBe("justified");
    expect(displayStatus({ ...w, proofs: [proof], status: "justified" })).toBe("justified");
    expect(displayStatus({ ...w, proofs: [proof], status: "validated" })).toBe("validated");
    // preuve retirée : redevient brouillon / à justifier
    expect(nextStatus({ ...w, proofs: [], status: "justified" })).toBe("draft");
  });
  it("cumule les compteurs d'un chantier", () => {
    const d = emptyAccountData("");
    d.settings.planning = cal;
    d.weatherDays = [
      newWeatherDay({ start: "2026-10-06", createdBy: "x", jobIds: ["j"], proofs: [proof], hoursLost: 8 }),
      newWeatherDay({ start: "2026-10-07", createdBy: "x", jobIds: ["j"], duration: "half", impact: "slowed", hoursLost: 2 }),
      newWeatherDay({ start: "2026-10-07", createdBy: "x", jobIds: ["autre"] }),
    ];
    const s = jobWeatherSummary(d, "j");
    expect(s).toMatchObject({ count: 2, days: 2, hours: 10, justified: 1, toJustify: 1 });
    expect(s.delay).toBe(1.3); // 1 + 0,5 × 0,5 → 1,25 arrondi
    expect(delayDays(d.weatherDays[1], cal)).toBe(0.25);
  });
  it("agrège les relevés journaliers", () => {
    expect(aggregateDaily({ precipitation_sum: [3.2, 10.15], temperature_2m_min: [4, 2.5], temperature_2m_max: [9, 11], wind_speed_10m_max: [30, 55.4] })).toEqual({ rainMm: 13.4, tMin: 2.5, tMax: 11, windKmh: 55 });
    expect(aggregateDaily({})).toEqual({ rainMm: null, tMin: null, tMax: null, windKmh: null });
  });
  it("retrouve la commune du chantier", () => {
    const d = emptyAccountData("");
    d.company.address.city = "Liège";
    expect(placeOf({ siteAddress: "Industrieweg 4, 9000 Gent" } as never, d)).toEqual({ postcode: "9000", city: "Gent" });
    expect(placeOf(undefined, d).city).toBe("Liège");
  });
  it("exporte un CSV lisible par Excel", () => {
    const d = emptyAccountData("");
    d.jobs = [{ id: "j", name: "Chantier ; Martin" } as never];
    const csv = weatherCsv([newWeatherDay({ start: "2026-10-06", createdBy: "Jean", jobIds: ["j"], hoursLost: 7.5, comment: 'Dit "stop"' })], d);
    expect(csv.startsWith("﻿Début;Fin;")).toBe(true);
    expect(csv).toContain('06/10/2026;06/10/2026;"Chantier ; Martin";Pluie');
    expect(csv).toContain(";7,5;");
    expect(csv).toContain('"Dit ""stop"""');
    expect(csv).toContain("À justifier");
  });
});
