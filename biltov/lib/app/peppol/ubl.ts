// Facture / note de crédit au format Peppol BIS Billing 3.0 (UBL 2.1, norme EN 16931).
// Généré localement ; l'envoi passe par un Access Point certifié (voir provider.ts).

import { normalizeBce, vatRate, type VatCode } from "../../tax/belgium";
import { computeTotals, lineTotal, countsInTotal, round2 } from "../money";
import type { AccountData, Address, Client, Doc } from "../types";

const CUSTOMIZATION = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0";
const PROFILE = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";

const UNIT: Record<string, string> = { u: "C62", pc: "C62", "m²": "MTK", "m³": "MTQ", ml: "MTR", m: "MTR", h: "HUR", j: "DAY", kg: "KGM", L: "LTR", km: "KMT", forfait: "LS", lot: "LS" };
export const unitCode = (u: string) => UNIT[u] ?? "C62";

/** Catégorie de TVA UNCL5305 + motif d'exonération éventuel. */
export function taxCategory(code: VatCode): { id: string; percent: number; reasonCode?: string; reason?: string } {
  switch (code) {
    case "21":
    case "12":
    case "6":
      return { id: "S", percent: vatRate(code) };
    case "0":
      return { id: "Z", percent: 0 };
    case "reverse":
      return { id: "AE", percent: 0, reasonCode: "VATEX-EU-AE", reason: "Autoliquidation" };
    case "franchise":
      // Catégorie à confirmer avec le prestataire Peppol (franchise des petites entreprises)
      return { id: "E", percent: 0, reason: "Régime particulier de franchise des petites entreprises" };
    case "exempt":
      return { id: "E", percent: 0, reason: "Opération exemptée" };
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const amt = (n: number) => round2(n).toFixed(2);
const tag = (name: string, value: string | number, attrs = "") => `<${name}${attrs}>${typeof value === "number" ? value : esc(value)}</${name}>`;
const money = (name: string, n: number) => `<${name} currencyID="EUR">${amt(n)}</${name}>`;

function address(a: Address) {
  return `<cac:PostalAddress>${tag("cbc:StreetName", a.street)}${tag("cbc:CityName", a.city)}${tag("cbc:PostalZone", a.postcode)}<cac:Country>${tag("cbc:IdentificationCode", a.country || "BE")}</cac:Country></cac:PostalAddress>`;
}

function party(name: string, addr: Address, bce: string, vat: string, contact?: { email?: string; phone?: string }) {
  const id = normalizeBce(bce);
  return [
    "<cac:Party>",
    id ? `<cbc:EndpointID schemeID="0208">${id}</cbc:EndpointID>` : "",
    `<cac:PartyName>${tag("cbc:Name", name)}</cac:PartyName>`,
    address(addr),
    vat ? `<cac:PartyTaxScheme>${tag("cbc:CompanyID", vat.replace(/[\s.]/g, "").toUpperCase())}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:PartyTaxScheme>` : "",
    `<cac:PartyLegalEntity>${tag("cbc:RegistrationName", name)}${id ? `<cbc:CompanyID schemeID="0208">${id}</cbc:CompanyID>` : ""}</cac:PartyLegalEntity>`,
    contact && (contact.email || contact.phone) ? `<cac:Contact>${contact.phone ? tag("cbc:Telephone", contact.phone) : ""}${contact.email ? tag("cbc:ElectronicMail", contact.email) : ""}</cac:Contact>` : "",
    "</cac:Party>",
  ].join("");
}

function categoryXml(code: VatCode) {
  const c = taxCategory(code);
  return `<cac:TaxCategory>${tag("cbc:ID", c.id)}${tag("cbc:Percent", c.percent)}${c.reasonCode ? tag("cbc:TaxExemptionReasonCode", c.reasonCode) : ""}${c.reason && c.id !== "S" ? tag("cbc:TaxExemptionReason", c.reason) : ""}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:TaxCategory>`;
}

export type UblResult = { xml: string; totals: ReturnType<typeof computeTotals>; lineExtension: number; allowances: number };

export function buildUbl(doc: Doc, data: AccountData, client: Client, source?: Doc | null): UblResult {
  const c = data.company;
  const credit = doc.type === "credit";
  const root = credit ? "CreditNote" : "Invoice";
  const lineTag = credit ? "CreditNoteLine" : "InvoiceLine";
  const qtyTag = credit ? "cbc:CreditedQuantity" : "cbc:InvoicedQuantity";
  const t = computeTotals(doc);
  const items = doc.lines.filter(countsInTotal);
  const lineExtension = round2(items.reduce((s, l) => s + lineTotal(l), 0));
  const factor = (doc.globalDiscountPercent || 0) / 100;

  // Remises globales et déductions (acomptes) : une AllowanceCharge par code de TVA
  const allowances: { reason: string; amount: number; code: VatCode }[] = [];
  if (factor > 0) {
    const byCode = new Map<VatCode, number>();
    for (const l of items) byCode.set(l.vat, (byCode.get(l.vat) ?? 0) + lineTotal(l) * factor);
    for (const [code, a] of byCode) allowances.push({ reason: "Remise", amount: round2(a), code });
  }
  for (const dd of doc.deductions) allowances.push({ reason: dd.label, amount: round2(dd.amount), code: dd.vat });
  const allowanceTotal = round2(allowances.reduce((s, a) => s + a.amount, 0));

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<${root} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${root}-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    tag("cbc:CustomizationID", CUSTOMIZATION),
    tag("cbc:ProfileID", PROFILE),
    tag("cbc:ID", doc.number ?? "BROUILLON"),
    tag("cbc:IssueDate", doc.issueDate),
    !credit && doc.dueDate ? tag("cbc:DueDate", doc.dueDate) : "",
    credit ? tag("cbc:CreditNoteTypeCode", 381) : tag("cbc:InvoiceTypeCode", doc.kind === "deposit" ? 386 : 380),
    doc.notes ? tag("cbc:Note", doc.notes) : "",
    tag("cbc:DocumentCurrencyCode", "EUR"),
    tag("cbc:BuyerReference", (data.jobs.find((j) => j.id === doc.jobId)?.name ?? doc.number ?? "-").slice(0, 60)),
    credit && source?.number ? `<cac:BillingReference><cac:InvoiceDocumentReference>${tag("cbc:ID", source.number)}${tag("cbc:IssueDate", source.issueDate)}</cac:InvoiceDocumentReference></cac:BillingReference>` : "",
    `<cac:AccountingSupplierParty>${party(c.name, c.address, c.bce, c.vatRegime === "normal" ? `BE${normalizeBce(c.bce)}` : "", { email: c.email, phone: c.phone })}</cac:AccountingSupplierParty>`,
    `<cac:AccountingCustomerParty>${party(client.name, client.billing, client.bce, client.vatNumber, { email: client.email, phone: client.phone })}</cac:AccountingCustomerParty>`,
    doc.workDate ? `<cac:Delivery>${tag("cbc:ActualDeliveryDate", doc.workDate)}</cac:Delivery>` : "",
    !credit && c.iban
      ? `<cac:PaymentMeans>${tag("cbc:PaymentMeansCode", 30)}${doc.structuredComm ? tag("cbc:PaymentID", doc.structuredComm) : ""}<cac:PayeeFinancialAccount>${tag("cbc:ID", c.iban.replace(/\s/g, ""))}${tag("cbc:Name", c.name)}${c.bic ? `<cac:FinancialInstitutionBranch>${tag("cbc:ID", c.bic)}</cac:FinancialInstitutionBranch>` : ""}</cac:PayeeFinancialAccount></cac:PaymentMeans>`
      : "",
    !credit ? `<cac:PaymentTerms>${tag("cbc:Note", `Paiement pour le ${doc.dueDate}`)}</cac:PaymentTerms>` : "",
    ...allowances.map((a) => `<cac:AllowanceCharge>${tag("cbc:ChargeIndicator", "false")}${tag("cbc:AllowanceChargeReason", a.reason)}${money("cbc:Amount", a.amount)}${categoryXml(a.code)}</cac:AllowanceCharge>`),
    `<cac:TaxTotal>${money("cbc:TaxAmount", t.vat)}${t.vatRows.map((r) => `<cac:TaxSubtotal>${money("cbc:TaxableAmount", r.base)}${money("cbc:TaxAmount", r.vat)}${categoryXml(r.code)}</cac:TaxSubtotal>`).join("")}</cac:TaxTotal>`,
    `<cac:LegalMonetaryTotal>${money("cbc:LineExtensionAmount", lineExtension)}${money("cbc:TaxExclusiveAmount", t.htva)}${money("cbc:TaxInclusiveAmount", t.tvac)}${allowanceTotal ? money("cbc:AllowanceTotalAmount", allowanceTotal) : ""}${t.paid ? money("cbc:PrepaidAmount", t.paid) : ""}${money("cbc:PayableAmount", round2(t.tvac - t.paid))}</cac:LegalMonetaryTotal>`,
    ...items.map((l, i) => {
      const gross = round2(l.qty * l.unitPrice);
      const net = lineTotal(l);
      const cat = taxCategory(l.vat);
      return [
        `<cac:${lineTag}>`,
        tag("cbc:ID", i + 1),
        `<${qtyTag} unitCode="${unitCode(l.unit)}">${l.qty}</${qtyTag}>`,
        money("cbc:LineExtensionAmount", net),
        gross !== net ? `<cac:AllowanceCharge>${tag("cbc:ChargeIndicator", "false")}${tag("cbc:AllowanceChargeReason", "Remise")}${money("cbc:Amount", round2(gross - net))}</cac:AllowanceCharge>` : "",
        `<cac:Item>${tag("cbc:Name", l.label.slice(0, 200) || "-")}<cac:ClassifiedTaxCategory>${tag("cbc:ID", cat.id)}${tag("cbc:Percent", cat.percent)}<cac:TaxScheme>${tag("cbc:ID", "VAT")}</cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>`,
        `<cac:Price>${money("cbc:PriceAmount", l.unitPrice)}</cac:Price>`,
        `</cac:${lineTag}>`,
      ].join("");
    }),
    `</${root}>`,
  ].join("");
  return { xml, totals: t, lineExtension, allowances: allowanceTotal };
}

/** Contrôles de cohérence EN 16931 essentiels (sous-ensemble des règles BR-CO). */
export function checkUbl(r: UblResult): string[] {
  const errs: string[] = [];
  const t = r.totals;
  if (round2(r.lineExtension - r.allowances) !== t.htva) errs.push("BR-CO-13 : total HTVA ≠ lignes − remises");
  if (round2(t.htva + t.vat) !== t.tvac) errs.push("BR-CO-15 : TVAC ≠ HTVA + TVA");
  if (round2(t.vatRows.reduce((s, x) => s + x.vat, 0)) !== t.vat) errs.push("BR-CO-14 : TVA ≠ somme des sous-totaux");
  if (!/<cbc:BuyerReference>/.test(r.xml)) errs.push("PEPPOL-EN16931-R003 : référence acheteur manquante");
  if (!/<cac:AccountingCustomerParty>/.test(r.xml)) errs.push("Client manquant");
  return errs;
}
