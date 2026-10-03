import { describe, expect, it } from "vitest";
import { area, linear, seedKg, tiles, tilesToM2, tonnage, volume } from "./calc";
import { contractAmount, dueContracts, generateOccurrence, nextOccurrence, yearlyValue } from "./contracts";
import { emptyAccountData, newClient } from "./defaults";
import type { AccountData, Contract } from "./types";

describe("calculateurs", () => {
  it("surfaces, volumes, tonnages", () => {
    expect(area(5, 4)).toBe(20);
    expect(volume(20, 15)).toBe(3);
    expect(tonnage(3, 1.6, 10)).toBe(5.28);
    expect(seedKg(200)).toBe(7);
    expect(linear(12, 1, 5)).toBe(13);
  });
  it("carrelage 60×60 avec 10 % de perte et boîtes de 4", () => {
    const r = tiles(18, 60, 60, 10, 4);
    expect(r).toEqual({ tiles: 55, boxes: 14, m2Ordered: 20.16, tileM2: 0.36 });
    expect(tilesToM2(55, 60, 60)).toBe(19.8);
  });
});

describe("contrats d'entretien", () => {
  it("échéances mensuelles en fin de mois et trimestrielles", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextOccurrence("2026-11-15", "quarterly")).toBe("2027-02-15");
    expect(nextOccurrence("2026-10-01", "weekly")).toBe("2026-10-08");
  });
  it("génère facture (TVA jardin 21 %) et intervention, puis avance l'échéance", () => {
    const c: Contract = { id: "k", clientId: "c", jobId: null, title: "Tonte", frequency: "monthly", startDate: "2026-10-01", nextDate: "2026-10-01", endDate: null, lines: [{ label: "Tonte pelouse", qty: 2, unit: "h", unitPrice: 45, category: "garden_maintenance" }], memberIds: ["m"], active: true, history: [] };
    const d0: AccountData = { ...emptyAccountData("a"), clients: [newClient({ id: "c", name: "Villa Durand" })], contracts: [c] };
    expect(dueContracts(d0, 7, "2026-09-28")).toHaveLength(1);
    expect(contractAmount(c)).toBe(90);
    expect(yearlyValue(c)).toBe(1080);
    const [d, r] = generateOccurrence(d0, "k");
    expect(r!.invoice.lines[0].vat).toBe("21");
    expect(r!.event.memberIds).toEqual(["m"]);
    expect(d.contracts[0].nextDate).toBe("2026-11-01");
    expect(d.jobs).toHaveLength(1);
    expect(d.contracts[0].history).toHaveLength(1);
  });
});
