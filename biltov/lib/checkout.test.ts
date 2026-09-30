import { describe, expect, it } from "vitest";
import { TRIAL_DAYS, trialDaysLeft } from "./checkout";

describe("essai gratuit", () => {
  const created = "2026-09-01T10:00:00Z";
  it("dure 5 jours à partir de la création du compte", () => {
    expect(TRIAL_DAYS).toBe(5);
    expect(trialDaysLeft(created, Date.parse(created))).toBe(5);
    expect(trialDaysLeft(created, Date.parse("2026-09-03T10:00:00Z"))).toBe(3);
    expect(trialDaysLeft(created, Date.parse("2026-09-06T09:59:00Z"))).toBe(1);
    expect(trialDaysLeft(created, Date.parse("2026-09-06T10:00:01Z"))).toBe(0);
  });
});
