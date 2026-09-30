import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newJob, newLine } from "./defaults";
import { computeTotals } from "./money";
import { addPayment, createQuote, creditNote, issueBlockers, issueDoc, jobFinance, newQuoteVersion, quoteToInvoice, signQuote } from "./ops";
import type { AccountData } from "./types";

function setup(kind: "particulier" | "assujetti" = "particulier") {
  let d: AccountData = emptyAccountData("a@b.be");
  d.company = { ...d.company, name: "Test SRL", owner: "Jean", legalForm: "SRL", bce: "0403.170.701", address: { street: "Rue 1", postcode: "1000", city: "Bruxelles", country: "BE" }, iban: "BE68 5390 0754 7034" };
  const client = newClient({ kind, name: "Client", vatNumber: kind === "assujetti" ? "BE0403170701" : "", billing: { street: "Rue 2", postcode: "4000", city: "Liège", country: "BE" } });
  const job = newJob({ clientId: client.id, name: "Chantier", firstOccupationYear: 1990 });
  d = { ...d, clients: [client], jobs: [job] };
  const lines = [newLine({ label: "Main-d'œuvre", qty: 10, unit: "h", unitPrice: 50, category: "labour" }), newLine({ label: "Matériaux posés", qty: 1, unitPrice: 500, category: "installed_material" }), newLine({ label: "Fourniture seule", qty: 1, unitPrice: 100, category: "supply_only" })];
  const [d2, quote] = createQuote(d, job.id, lines);
  return { d: d2, quote, job };
}

describe("devis et TVA", () => {
  it("applique 6 % à la rénovation, 21 % à la fourniture seule", () => {
    const { quote } = setup();
    expect(quote.lines.map((l) => l.vat)).toEqual(["6", "6", "21"]);
    const t = computeTotals(quote);
    expect(t.htva).toBe(1100);
    expect(t.vatRows).toEqual([
      { code: "21", rate: 21, base: 100, vat: 21 },
      { code: "6", rate: 6, base: 1000, vat: 60 },
    ]);
    expect(t.tvac).toBe(1181);
  });
  it("autoliquidation pour un assujetti", () => {
    const { quote } = setup("assujetti");
    expect(quote.lines.map((l) => l.vat)).toEqual(["reverse", "reverse", "21"]);
  });
  it("options non retenues exclues du total, remise globale appliquée", () => {
    const { quote } = setup();
    const q = { ...quote, globalDiscountPercent: 10, lines: [...quote.lines, newLine({ label: "Option", unitPrice: 999, optional: true, selected: false })] };
    expect(computeTotals(q).htva).toBe(990);
  });
  it("versions successives du devis", () => {
    const { d, quote } = setup();
    const [, v2] = newQuoteVersion(d, quote.id);
    expect(v2.number).toBe(`${quote.number} v2`);
    expect(v2.previousId).toBe(quote.id);
  });
});

describe("facturation", () => {
  it("numérotation continue sans trou, et facture émise immuable", () => {
    const { d, quote } = setup();
    let data = signQuote(d, quote.id, { image: "", name: "C", at: "" });
    const [d1, inv1] = quoteToInvoice(data, quote.id, "deposit", { percent: 30 });
    const [d2, inv2] = quoteToInvoice(d1, quote.id, "full");
    // l'ordre d'émission, pas de création, fixe les numéros
    const [d3, i2] = issueDoc(d2, inv2.id);
    const [d4, i1] = issueDoc(d3, inv1.id);
    expect(i2!.number).toMatch(/-0001$/);
    expect(i1!.number).toMatch(/-0002$/);
    expect(i1!.structuredComm).toMatch(/^\+\+\+/);
    const [, again] = issueDoc(d4, inv1.id);
    expect(again).toBeNull();
    data = d4;
    expect(data.audit.some((a) => a.action === "issue")).toBe(true);
  });
  it("acompte puis facture finale : les acomptes sont déduits par taux", () => {
    const { d, quote } = setup();
    const signed = signQuote(d, quote.id, { image: "", name: "C", at: "" });
    const [d1, dep] = quoteToInvoice(signed, quote.id, "deposit", { percent: 30 });
    const [d2] = issueDoc(d1, dep.id);
    const [, fin] = quoteToInvoice(d2, quote.id, "final");
    const t = computeTotals(fin);
    expect(t.htva).toBe(770); // 1100 − 30 %
    expect(t.tvac).toBe(826.7); // 1181 × 70 %
  });
  it("situation : facture l'avancement non encore facturé", () => {
    const { d, quote } = setup();
    const signed = signQuote(d, quote.id, { image: "", name: "C", at: "" });
    const first = quote.lines[0].id;
    const [d1, s1] = quoteToInvoice(signed, quote.id, "situation", { progress: { [first]: 40 } });
    expect(s1.lines[0].qty).toBe(4);
    const [d2] = issueDoc(d1, s1.id);
    const [, s2] = quoteToInvoice(d2, quote.id, "situation", { progress: { [first]: 100 } });
    expect(s2.lines[0].qty).toBe(6);
  });
  it("note de crédit totale : la facture est annulée", () => {
    const { d, quote } = setup();
    const [d1, inv] = quoteToInvoice(d, quote.id, "full");
    const [d2] = issueDoc(d1, inv.id);
    const [d3, nc] = creditNote(d2, inv.id);
    const [d4, ncIssued] = issueDoc(d3, nc!.id);
    expect(ncIssued!.number).toMatch(/^NC-/);
    expect(d4.docs.find((x) => x.id === inv.id)!.status).toBe("cancelled");
  });
  it("paiements partiels puis solde", () => {
    const { d, quote } = setup();
    const [d1, inv] = quoteToInvoice(d, quote.id, "full");
    const [d2, issued] = issueDoc(d1, inv.id);
    const d3 = addPayment(d2, issued!.id, { date: "2026-01-01", amount: 500, method: "Virement", reference: "" });
    expect(d3.docs.find((x) => x.id === inv.id)!.status).toBe("partial");
    const d4 = addPayment(d3, issued!.id, { date: "2026-01-02", amount: 681, method: "Virement", reference: "" });
    expect(d4.docs.find((x) => x.id === inv.id)!.status).toBe("paid");
    expect(jobFinance(d4, issued!.jobId).cashed).toBe(1181);
  });
  it("émission bloquée si une mention obligatoire manque", () => {
    const { d, quote } = setup();
    const broken = { ...d, company: { ...d.company, bce: "123" } };
    const [d1, inv] = quoteToInvoice(broken, quote.id, "full");
    expect(issueBlockers(d1, inv)).toContain("Numéro d'entreprise (BCE) valide");
    expect(issueDoc(d1, inv.id)[1]).toBeNull();
  });
});
