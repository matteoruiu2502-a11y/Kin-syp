import { describe, expect, it } from "vitest";
import { TRIAL } from "./plans";
import { entitlementOf, trialSubscription } from "./billing/entitlement";

describe("essai gratuit", () => {
  const created = "2026-09-01T10:00:00Z";
  const left = (now: string) => entitlementOf(trialSubscription(new Date(created).toISOString()), Date.parse(now));
  it("dure 5 jours à partir de la création du compte", () => {
    expect(TRIAL.days).toBe(5);
    expect(left(created).daysLeft).toBe(5);
    expect(left("2026-09-03T10:00:00Z").daysLeft).toBe(3);
    expect(left("2026-09-06T09:59:00Z").daysLeft).toBe(1);
    expect(left("2026-09-06T10:00:01Z").status).toBe("expired");
  });
});
