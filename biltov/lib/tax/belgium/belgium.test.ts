import { describe, expect, it } from "vitest";
import {
  b2cGraceEnd,
  b2cIndemnityCap,
  communicationForInvoice,
  decideVat,
  dunningPlan,
  formatBce,
  isBce,
  isBeVat,
  isIban,
  isStructuredCommunication,
  legal,
  mentionsFor,
  structuredCommunication,
  vatFromBce,
  type VatContext,
} from ".";

const base: VatContext = { date: "2026-03-10", companyRegime: "normal", clientKind: "particulier", workKind: "immobilier", privateHousing: true, firstOccupationYear: 2000 };

describe("identifiants belges (modulo 97)", () => {
  it("numéro d'entreprise BCE", () => {
    expect(isBce("0403.170.701")).toBe(true); // numéro public connu
    expect(isBce("0403.170.702")).toBe(false);
    expect(isBce("403170701")).toBe(true); // ancien format 9 chiffres
    expect(formatBce("0403170701")).toBe("0403.170.701");
  });
  it("TVA BE", () => {
    expect(vatFromBce("0403.170.701")).toBe("BE0403170701");
    expect(isBeVat("BE 0403.170.701")).toBe(true);
    expect(isBeVat("BE0403170702")).toBe(false);
  });
  it("communication structurée", () => {
    const c = structuredCommunication("2026000042");
    expect(c).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
    expect(isStructuredCommunication(c)).toBe(true);
    expect(isStructuredCommunication("+++090/9337/55493+++")).toBe(true);
    expect(isStructuredCommunication("+++090/9337/55494+++")).toBe(false);
    expect(communicationForInvoice("F-2026-0042")).toBe(c);
    // reste 0 → contrôle 97
    expect(structuredCommunication("0000000097")).toBe("+++000/0000/09797+++");
  });
  it("IBAN belge", () => {
    expect(isIban("BE68 5390 0754 7034")).toBe(true);
    expect(isIban("BE68 5390 0754 7035")).toBe(false);
  });
});

describe("moteur TVA", () => {
  it("6 % : logement privé ≥ 10 ans, consommateur final, main-d'œuvre et matériaux posés", () => {
    expect(decideVat(base, "labour").code).toBe("6");
    expect(decideVat(base, "installed_material").code).toBe("6");
  });
  it("10 ans calculés en années civiles", () => {
    expect(decideVat({ ...base, firstOccupationYear: 2016 }, "labour").code).toBe("6"); // 2026 − 2016 = 10
    expect(decideVat({ ...base, firstOccupationYear: 2017 }, "labour").code).toBe("21");
  });
  it("fourniture sans pose : 21 %", () => expect(decideVat(base, "supply_only").code).toBe("21"));
  it("non-logement ou année inconnue : 21 %", () => {
    expect(decideVat({ ...base, privateHousing: false }, "labour").code).toBe("21");
    expect(decideVat({ ...base, firstOccupationYear: null }, "labour").code).toBe("21");
  });
  it("chaudière fossile : installation 21 % depuis la date configurée, entretien 6 %", () => {
    expect(decideVat(base, "fossil_boiler_install").code).toBe("21");
    expect(decideVat({ ...base, date: "2025-06-01" }, "fossil_boiler_install").code).toBe("6");
    expect(decideVat(base, "fossil_boiler_service").code).toBe("6");
  });
  it("pompe à chaleur : régime configurable", () => expect(decideVat(base, "heat_pump").code).toBe(legal("vat.heatPump.rate") === 6 ? "6" : "21"));
  it("assujetti déposant + travaux immobiliers : autoliquidation", () => {
    expect(decideVat({ ...base, clientKind: "assujetti" }, "labour").code).toBe("reverse");
    expect(decideVat({ ...base, clientKind: "assujetti" }, "supply_only").code).toBe("21");
  });
  it("livraison de biens pour un particulier : 21 %", () => expect(decideVat({ ...base, workKind: "livraison" }, "installed_material").code).toBe("21"));
  it("entreprise en franchise : pas de TVA", () => expect(decideVat({ ...base, companyRegime: "franchise" }, "labour").code).toBe("franchise"));
  it("client étranger : avertissement", () => expect(decideVat({ ...base, clientKind: "etranger" }, "labour").warning).toBeTruthy());
  it("mentions selon les codes, dans la langue du client", () => {
    expect(mentionsFor(["6", "21"], "fr")[0]).toMatch(/^Taux de TVA/);
    expect(mentionsFor(["reverse"], "nl")[0]).toMatch(/^Verlegging van heffing/);
    expect(mentionsFor(["franchise"], "de")[0]).toMatch(/Kleinunternehmen/);
    expect(mentionsFor(["21"], "fr")).toEqual([]);
  });
});

describe("rappels B2C (Livre XIX)", () => {
  it("délai de 14 jours à partir du lendemain d'un envoi électronique", () => {
    expect(b2cGraceEnd("2026-03-02", "electronic")).toBe("2026-03-16");
  });
  it("envoi postal : départ au 3e jour ouvrable", () => {
    // envoi un vendredi → 3e jour ouvrable = mercredi 11/03 → fin le 24/03
    expect(b2cGraceEnd("2026-03-06", "postal")).toBe("2026-03-24");
  });
  it("plan : 1er rappel gratuit, frais seulement après le délai", () => {
    const plan = dunningPlan({ b2c: true, dueDate: "2026-03-01" });
    expect(plan[0]).toMatchObject({ kind: "free_reminder", feesAllowed: false, earliest: "2026-03-02" });
    expect(plan[1].earliest > "2026-03-16").toBe(true);
  });
  it("plafond d'indemnité par tranche", () => {
    expect(b2cIndemnityCap(100)).toBe(20);
    expect(b2cIndemnityCap(400)).toBe(55);
    expect(b2cIndemnityCap(1500)).toBe(115);
    expect(b2cIndemnityCap(1_000_000)).toBe(2000);
  });
});
