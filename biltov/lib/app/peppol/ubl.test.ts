import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newJob, newLine } from "../defaults";
import { createQuote, issueDoc, quoteToInvoice } from "../ops";
import { buildUbl, checkUbl, unitCode } from "./ubl";
import { participantId, requiresPeppol } from "./provider";

function invoice(kind: "particulier" | "assujetti", discount = 0) {
  let d = emptyAccountData("a@b.be");
  d.company = { ...d.company, name: "Test & Fils SRL", bce: "0403170701", address: { street: "Rue 1", postcode: "1000", city: "Bruxelles", country: "BE" }, iban: "BE68 5390 0754 7034", bic: "GKCCBEBB" };
  const client = newClient({ kind, name: "Client <SA>", bce: kind === "assujetti" ? "0403170701" : "", vatNumber: kind === "assujetti" ? "BE0403170701" : "", billing: { street: "Rue 2", postcode: "4000", city: "Liège", country: "BE" } });
  const job = newJob({ clientId: client.id, name: "Chantier", firstOccupationYear: 1990 });
  d = { ...d, clients: [client], jobs: [job] };
  const [d1, q] = createQuote(d, job.id, [newLine({ label: "MO", qty: 3, unit: "h", unitPrice: 45.5, discountPercent: 10 }), newLine({ label: "Fourniture", qty: 2, unitPrice: 19.99, category: "supply_only" })], { globalDiscountPercent: discount });
  const [d2, inv] = quoteToInvoice(d1, q.id, "full");
  const [d3, issued] = issueDoc(d2, inv.id);
  return { d: d3, doc: issued!, client };
}

describe("Peppol UBL BIS 3.0", () => {
  it("facture assujetti : autoliquidation AE + 21 %, totaux cohérents", () => {
    const { d, doc, client } = invoice("assujetti");
    const r = buildUbl(doc, d, client);
    expect(checkUbl(r)).toEqual([]);
    expect(r.xml).toContain('<cbc:EndpointID schemeID="0208">0403170701</cbc:EndpointID>');
    expect(r.xml).toContain("<cbc:ID>AE</cbc:ID>");
    expect(r.xml).toContain("VATEX-EU-AE");
    expect(r.xml).toContain("<cbc:PaymentID>+++");
    expect(r.xml).toContain("Test &amp; Fils SRL");
    expect(r.xml).toContain("Client &lt;SA&gt;");
    expect(r.xml).toContain('unitCode="HUR"');
  });
  it("remise globale : AllowanceCharge et totaux cohérents", () => {
    const { d, doc, client } = invoice("particulier", 5);
    const r = buildUbl(doc, d, client);
    expect(checkUbl(r)).toEqual([]);
    expect(r.xml).toContain("<cbc:AllowanceChargeReason>Remise</cbc:AllowanceChargeReason>");
  });
  it("routage et identifiant", () => {
    expect(requiresPeppol({ kind: "assujetti", vatNumber: "BE0403170701" })).toBe(true);
    expect(requiresPeppol({ kind: "particulier", vatNumber: "" })).toBe(false);
    expect(participantId("0403.170.701")).toBe("0208:0403170701");
    expect(unitCode("m²")).toBe("MTK");
  });
});
