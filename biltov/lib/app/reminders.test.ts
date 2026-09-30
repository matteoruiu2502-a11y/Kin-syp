import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newJob, newLine } from "./defaults";
import { createQuote, issueDoc, logSend, quoteToInvoice } from "./ops";
import { dueReminders, reminderMessage, reminderState } from "./reminders";

function setup(kind: "particulier" | "assujetti") {
  let d = emptyAccountData("a@b.be");
  d.company = { ...d.company, name: "Test SRL", bce: "0403170701", address: { street: "R", postcode: "1000", city: "Bruxelles", country: "BE" }, iban: "BE68 5390 0754 7034" };
  const c = newClient({ kind, name: "Client", vatNumber: kind === "assujetti" ? "BE0403170701" : "", billing: { street: "R", postcode: "4000", city: "Liège", country: "BE" } });
  const j = newJob({ clientId: c.id, name: "Salle de bain" });
  d = { ...d, clients: [c], jobs: [j] };
  const [d1, q] = createQuote(d, j.id, [newLine({ label: "MO", qty: 10, unitPrice: 100 })]);
  const [d2, inv] = quoteToInvoice(d1, q.id, "full");
  const [d3, issued] = issueDoc(d2, inv.id);
  const doc = { ...issued!, dueDate: "2026-03-01" };
  return { d: { ...d3, docs: d3.docs.map((x) => (x.id === doc.id ? doc : x)) }, doc };
}

describe("relances B2C (Livre XIX)", () => {
  it("1er rappel gratuit le lendemain de l'échéance, sans frais", () => {
    const { d, doc } = setup("particulier");
    expect(dueReminders(d, "2026-03-01")).toHaveLength(0);
    const r = reminderState(d, doc, "2026-03-02");
    expect(r.due).toBe(true);
    expect(r.fees + r.interest).toBe(0);
    expect(reminderMessage(d, r).body).toContain("premier rappel est gratuit");
  });
  it("aucun frais pendant les 14 jours suivant le rappel, puis frais plafonnés", () => {
    const { d, doc } = setup("particulier");
    const sent = logSend(d, doc.id, { channel: "email", kind: "reminder", step: 0 });
    const d2 = { ...sent, docs: sent.docs.map((x) => (x.id === doc.id ? { ...x, sends: x.sends.map((s) => ({ ...s, at: "2026-03-02T10:00:00Z" })) } : x)) };
    const during = reminderState(d2, d2.docs.find((x) => x.id === doc.id)!, "2026-03-10");
    expect(during.due).toBe(false);
    const after = reminderState(d2, d2.docs.find((x) => x.id === doc.id)!, "2026-03-20");
    expect(after.due).toBe(true);
    expect(after.fees).toBe(100.5); // 1 210 € TVAC → 65 € + 5 % × (1 210 − 500)
  });
  it("contestation : relances suspendues", () => {
    const { d, doc } = setup("particulier");
    const d2 = { ...d, docs: d.docs.map((x) => (x.id === doc.id ? { ...x, dispute: { active: true, note: "conteste" } } : x)) };
    expect(dueReminders(d2, "2026-04-01")).toHaveLength(0);
  });
});

describe("relances B2B (loi du 2 août 2002)", () => {
  it("rappel à J+7, puis intérêts + indemnité forfaitaire", () => {
    const { d, doc } = setup("assujetti");
    expect(reminderState(d, doc, "2026-03-07").due).toBe(false);
    expect(reminderState(d, doc, "2026-03-08").due).toBe(true);
    const sent = logSend(d, doc.id, { channel: "email", kind: "reminder", step: 0 });
    const r = reminderState(sent, sent.docs.find((x) => x.id === doc.id)!, "2026-03-20");
    expect(r.fees).toBe(40);
    expect(r.interest).toBeGreaterThan(0);
  });
});
