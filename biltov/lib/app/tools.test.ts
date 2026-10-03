import { describe, expect, it } from "vitest";
import { emptyAccountData } from "./defaults";
import { assignTool, nextService, serviceDue } from "./tools";
import type { Tool } from "./types";

const tool: Tool = { id: "t", name: "Minipelle", category: "Machine", serial: "", purchaseDate: "2026-01-01", value: 30000, assignment: { type: "depot", id: null }, history: [], serviceIntervalDays: 250, lastService: "2026-02-01", status: "ok", notes: "" };

describe("outils", () => {
  it("prochain entretien et rappel", () => {
    expect(nextService(tool)).toBe("2026-10-09");
    expect(serviceDue(tool, "2026-10-01")).toBe(true);
    expect(serviceDue(tool, "2026-08-01")).toBe(false);
  });
  it("affectation avec historique", () => {
    const d = assignTool({ ...emptyAccountData("a"), tools: [tool] }, "t", { type: "job", id: "j" }, "terrassement");
    expect(d.tools[0].assignment).toEqual({ type: "job", id: "j" });
    expect(d.tools[0].history[0].note).toBe("terrassement");
  });
});
