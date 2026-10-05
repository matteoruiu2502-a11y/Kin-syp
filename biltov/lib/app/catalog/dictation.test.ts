import { describe, expect, it } from "vitest";
import { parseQuote } from "../../parseQuote";
import { newArticle } from "../defaults";
import { dictationToDetailedLines } from "./dictation";
import { recalcAll } from "./pricing";
import { searchArticles } from "./match";

const a = (ref: string, fr: string, unit: string, p: number, extra = {}) => newArticle({ ref, name: { fr, nl: "", de: "" }, unit, purchasePrice: p, marginPercent: 40, ...extra });
const cat = recalcAll([
  a("MO", "Main-d'œuvre plombier", "h", 38, { type: "labour", category: "labour" }),
  a("CU15", "Tube cuivre Ø15", "ml", 6),
  a("CU22", "Tube cuivre Ø22", "ml", 9),
  a("PER16", "Tube multicouche Ø16", "ml", 2.1),
  a("PER20", "Tube multicouche Ø20", "ml", 3),
  a("PVC40", "Tuyau PVC évacuation Ø40", "ml", 3.5),
  a("PVC100", "Tuyau PVC évacuation Ø100", "ml", 8),
  a("COUDE22", "Coude cuivre 90° Ø22", "u", 2),
  a("COUDE15", "Coude cuivre 90° Ø15", "u", 1.5),
  a("RAD", "Radiateur acier 600×1000", "u", 180),
  a("ROBA", "Robinet d'arrêt 1/2", "u", 9),
  a("MIT", "Mitigeur lavabo", "u", 60),
  a("MITD", "Mitigeur thermostatique douche", "u", 140),
  a("WC", "WC suspendu complet", "u", 220),
  a("BOIL", "Chauffe-eau électrique 200 L", "u", 390),
  a("CARR", "Carrelage grès cérame 60×60", "m²", 25),
  a("SIL", "Silicone sanitaire blanc", "u", 6),
]);
const cat2 = recalcAll([
  a("FAI", "Faïence murale 30×60", "m²", 24),
  a("DEP", "Dépose ancien carrelage", "m²", 8, { type: "labour", category: "labour" }),
  a("COL", "Colle carrelage C2 25 kg", "u", 17),
]);
const run = (s: string) => dictationToDetailedLines(parseQuote(s, "Main-d'œuvre"), cat, "fr");
const one = (s: string) => run(s)[0];

describe("dictée → bonne ligne, bonnes cases", () => {
  it("la spécification choisit le bon article (diamètre, dimension)", () => {
    expect(one("12 mètres de tuyau cuivre 22").line).toMatchObject({ label: "Tube cuivre Ø22", qty: 12, unit: "ml" });
    expect(one("12 mètres de tuyau cuivre 15").line.label).toBe("Tube cuivre Ø15");
    expect(one("un tube per 20 de 8 mètres").line).toMatchObject({ label: "Tube multicouche Ø20", qty: 8, unit: "ml" });
    expect(one("40 mètres de tuyau PVC 100").line.label).toBe("Tuyau PVC évacuation Ø100");
    expect(one("15 mètres de tuyau pvc 40").line.label).toBe("Tuyau PVC évacuation Ø40");
  });
  it("le produit précis l'emporte sur un produit voisin (mitigeur douche ≠ lavabo)", () => {
    expect(one("deux mitigeurs douche à 150 euros pièce").line).toMatchObject({ label: "Mitigeur thermostatique douche", qty: 2, unitPrice: 150 });
    expect(one("un mitigeur lavabo").line.label).toBe("Mitigeur lavabo");
    expect(one("un mitigeur thermostatiqe pour la douche").line.label).toBe("Mitigeur thermostatique douche"); // faute de frappe
  });
  it("prix du catalogue repris, prix dicté prioritaire", () => {
    expect(one("2 robinets d'arrêt").line).toMatchObject({ label: "Robinet d'arrêt 1/2", qty: 2, unit: "u", unitPrice: 12.6, costPrice: 9 });
    expect(one("2 robinets d'arrêt à 20 euros").line.unitPrice).toBe(20);
  });
  it("heures : main-d'œuvre, prix à l'heure, jamais confondu avec un produit", () => {
    expect(one("8 heures de travail à 55 euros de l'heure").line).toMatchObject({ label: "Main-d'œuvre plombier", qty: 8, unit: "h", unitPrice: 55, category: "labour" });
    expect(one("6 heures de main d'oeuvre").line).toMatchObject({ label: "Main-d'œuvre plombier", qty: 6, unit: "h" });
  });
  it("« mètres » de carrelage : l'unité du produit (m²), pas le mètre linéaire", () => {
    expect(one("20 mètres de carrelage 60 par 60").line).toMatchObject({ label: "Carrelage grès cérame 60×60", qty: 20, unit: "m²" });
  });
  it("capacité d'un appareil n'est pas une quantité", () => {
    expect(one("un chauffe-eau de 200 litres").line).toMatchObject({ label: "Chauffe-eau électrique 200 L", qty: 1, unit: "u" });
  });
  it("inconnu au catalogue : « à chiffrer », sans rien inventer", () => {
    expect(one("remplacement chaudière gaz").line).toMatchObject({ toPrice: true, unitPrice: 0, qty: 1 });
    expect(one("remplacement chaudière gaz à 4500 euros").line).toMatchObject({ toPrice: false, unitPrice: 4500 });
  });
  it("phrase complète : chaque information dans sa ligne", () => {
    const l = run("Pour Mme Peeters, 12 mètres de tuyau cuivre 22, 3 coudes cuivre 22, 2 robinets d'arrêt, un wc suspendu et 6 heures de main-d'œuvre").map((d) => `${d.line.qty} ${d.line.unit} ${d.line.label}`);
    expect(l).toEqual(["12 ml Tube cuivre Ø22", "3 u Coude cuivre 90° Ø22", "2 u Robinet d'arrêt 1/2", "1 u WC suspendu complet", "6 h Main-d'œuvre plombier"]);
    expect(run("un chauffe-eau de 200 litres et pose d'un wc suspendu")).toHaveLength(2);
  });
});

describe("le produit dit gagne sur son synonyme", () => {
  it("faïence ≠ dépose de carrelage", () => {
    const d = dictationToDetailedLines(parseQuote("15 m² de faïence", "Main-d'œuvre"), cat2, "fr")[0];
    expect(d.line.label).toBe("Faïence murale 30×60");
    expect(d.choices).toBeNull();
  });
});

describe("métier de l'entreprise", () => {
  it("« main-d'œuvre » : le métier de l'entreprise l'emporte, sans question", () => {
    const labour = recalcAll([
      a("MO-P", "Main-d'œuvre plombier", "h", 38, { type: "labour", category: "labour", trade: "plombier" }),
      a("MO-C", "Main-d'œuvre carreleur", "h", 36, { type: "labour", category: "labour", trade: "macon" }),
    ]);
    const p = parseQuote("6 heures de main-d'œuvre", "Main-d'œuvre");
    expect(dictationToDetailedLines(p, labour, "fr")[0].choices).toHaveLength(2);
    const d = dictationToDetailedLines(p, labour, "fr", undefined, "plombier")[0];
    expect(d.choices).toBeNull();
    expect(d.line.label).toBe("Main-d'œuvre plombier");
  });
});

describe("cas à clarifier", () => {
  it("produit au mètre inconnu du catalogue sans quantité : demander la longueur", () => {
    expect(one("du tuyau acier 40").qtyMissing).toBe(true);
    expect(one("un mitigeur lavabo").qtyMissing).toBe(false);
  });
  it("article ambigu → l'artisan choisit", () => {
    const d = one("12 mètres de tuyau cuivre");
    expect(d.choices?.map((c) => c.article.name.fr).sort()).toEqual(["Tube cuivre Ø15", "Tube cuivre Ø22"]);
    expect(one("3 coudes cuivre").choices).toHaveLength(2);
    expect(one("12 mètres de tuyau cuivre 22").choices).toBeNull();
  });
  it("quantité manquante pour une unité de mesure", () => {
    expect(one("tuyau cuivre 22").qtyMissing).toBe(true);
    expect(one("un mitigeur lavabo").qtyMissing).toBe(false);
    expect(one("2 robinets d'arrêt").qtyMissing).toBe(false);
  });
});

describe("recherche dans le catalogue", () => {
  it("trouve par mot, synonyme, faute de frappe et diamètre", () => {
    expect(searchArticles("toilettes", cat)[0].ref).toBe("WC");
    expect(searchArticles("tuyau cuivre 22", cat)[0].ref).toBe("CU22");
    expect(searchArticles("mitigeur thermostatiqe", cat)[0].ref).toBe("MITD");
  });
});
