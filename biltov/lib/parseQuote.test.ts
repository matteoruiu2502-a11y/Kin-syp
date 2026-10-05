import { describe, expect, it } from "vitest";
import { digitize, extractClient, parseQuote } from "./parseQuote";

const MO = "Main-d'œuvre";
const lines = (s: string) => parseQuote(s, MO).lines.map((l) => ({ label: l.label, qty: l.qty, unit: l.unit, price: l.priceGiven ? l.price : null, qtyGiven: l.qtyGiven }));

describe("nombres en lettres", () => {
  it("convertit en chiffres", () => {
    expect(digitize("douze mètres")).toBe("12 mètres");
    expect(digitize("quatre-vingt-dix euros")).toBe("90 euros");
    expect(digitize("soixante et onze")).toBe("71");
    expect(digitize("deux cent trente")).toBe("230");
    expect(digitize("mille deux cents")).toBe("1200");
    expect(digitize("vingt et un")).toBe("21");
    expect(digitize("quatre-vingts")).toBe("80");
    expect(digitize("un tuyau et deux coudes")).toBe("un tuyau et 2 coudes");
  });
});

describe("client", () => {
  it("n'importe où dans la phrase", () => {
    expect(extractClient("Pour Mme Peeters, 24 m² de parquet")).toEqual({ client: "Mme Peeters", rest: "24 m² de parquet" });
    expect(extractClient("chez monsieur Dubois 20 mètres de tube").client).toBe("M. Dubois");
    expect(extractClient("12 mètres de tuyau, c'est pour Mme Claes").client).toBe("Mme Claes");
    expect(extractClient("le client c'est Janssens, 3 prises").client).toBe("Janssens");
    expect(extractClient("pour famille Wouters in Leuven, afwassen").rest).toBe("afwassen");
    expect(extractClient("pour 6 heures de travail").client).toBeNull();
    expect(extractClient("pour madame de Smet, 3 prises").client).toBe("Mme De Smet");
  });
});

describe("quantité, unité, prix, spécification dans les bonnes cases", () => {
  it("tuyau : la spécification reste dans le libellé, la quantité va en quantité", () => {
    expect(lines("12 mètres de tuyau cuivre 22")).toEqual([{ label: "Tuyau cuivre 22", qty: 12, unit: "ml", price: null, qtyGiven: true }]);
    expect(lines("un tube per 20 de 8 mètres")).toEqual([{ label: "Tube per 20", qty: 8, unit: "ml", price: null, qtyGiven: true }]);
    expect(lines("20 mètres de tube multicouche 16 à 3 euros du mètre")[0]).toMatchObject({ label: "Tube multicouche 16", qty: 20, unit: "ml", price: 3 });
    expect(lines("40 mètres de tuyau PVC 100 et 15 mètres de tuyau pvc 40")).toMatchObject([{ qty: 40, label: "Tuyau PVC 100" }, { qty: 15, label: "Tuyau pvc 40" }]);
  });
  it("nombre en tête, en lettres ou en chiffres", () => {
    expect(lines("3 coudes, deux robinets d'arrêt et un mitigeur lavabo")).toMatchObject([{ qty: 3, label: "Coudes" }, { qty: 2, label: "Robinets d'arrêt" }, { qty: 1, label: "Mitigeur lavabo", qtyGiven: true }]);
  });
  it("dimensions et capacités ne sont pas des quantités", () => {
    expect(lines("un radiateur 600 par 1000")[0]).toMatchObject({ qty: 1, label: "Radiateur 600 par 1000" });
    expect(lines("un chauffe-eau de 200 litres")[0]).toMatchObject({ qty: 1, unit: "u", label: "Chauffe-eau de 200 litres" });
    expect(lines("2 fenêtres 120 sur 135")[0]).toMatchObject({ qty: 2 });
    expect(lines("tuyau 22 mm")[0]).toMatchObject({ qty: 1, qtyGiven: false, label: "Tuyau 22 mm" });
    expect(lines("50 litres de peinture")[0]).toMatchObject({ qty: 50, unit: "L" });
  });
  it("prix : unitaire, à l'heure, pièce, forfait", () => {
    expect(lines("8 heures de travail à 55 euros de l'heure")).toEqual([{ label: MO, qty: 8, unit: "h", price: 55, qtyGiven: true }]);
    expect(lines("deux mitigeurs douche à 150 euros pièce")[0]).toMatchObject({ label: "Mitigeurs douche", qty: 2, unit: "u", price: 150 });
    expect(lines("forfait déplacement 80 euros")[0]).toMatchObject({ qty: 1, unit: "forfait", price: 80, label: "Déplacement" });
    expect(lines("remplacement de la chaudière pour 4500 euros le tout")[0]).toMatchObject({ qty: 1, unit: "forfait", price: 4500 });
    expect(lines("une heure et demie de main d'oeuvre")[0]).toMatchObject({ qty: 1.5, unit: "h", label: MO });
    expect(lines("6 heures de main-d'œuvre plombier")[0]).toMatchObject({ qty: 6, unit: "h", label: `${MO} plombier` });
  });
  it("fourniture et pose ne se coupe pas ; « et » sépare deux articles", () => {
    expect(lines("fourniture et pose de 12 m² de carrelage")).toHaveLength(1);
    expect(lines("fourniture et pose de 12 m² de carrelage et 3 prises")).toHaveLength(2);
    expect(lines("tuyau en cuivre 22")).toHaveLength(1);
  });
  it("démo d'accueil : néerlandais et allemand", () => {
    const nl = parseQuote("Voor mevrouw Peeters in Gent, vervanging van de elektrische boiler 200 liter, veiligheidsgroep en 3 uur werk.", MO);
    expect(nl.client).toBe("Mme Peeters");
    expect(nl.lines.at(-1)).toMatchObject({ qty: 3, unit: "h", label: MO });
    const de = parseQuote("Für Frau Schmitz in Eupen, Austausch des elektrischen Boilers 200 Liter, Sicherheitsgruppe und 3 Stunden Arbeitszeit.", MO);
    expect(de.client).toBe("Mme Schmitz");
    expect(de.lines.at(-1)).toMatchObject({ qty: 3, unit: "h" });
    expect(parseQuote("Pour Mme Martin, pose de 24 m² de parquet chêne à 45 euros, 12 ml de plinthes à 9 euros et 6 heures de main-d'œuvre à 50 euros.", MO).lines).toMatchObject([{ qty: 24, unit: "m²", price: 45 }, { qty: 12, unit: "ml", price: 9 }, { qty: 6, unit: "h", price: 50 }]);
  });
  it("démo d'accueil française : client avec article, quantité après « pose de », mots de liaison", () => {
    const r = parseQuote("Pour la famille Dubois à Mons, lessivage, deux couches de latex blanc sur 38 m² de murs, plafond de 14 m² en mat.", MO);
    expect(r.client).toBe("Famille Dubois");
    expect(r.lines.map((l) => `${l.qty} ${l.unit} ${l.label}`)).toEqual(["1 u Lessivage", "38 m² 2 couches de latex blanc sur murs", "14 m² Plafond en mat"]);
    expect(parseQuote("Pour Mme Claes à Bruxelles, pose de 3 châssis PVC double vitrage 120 sur 135, démontage des anciens châssis.", MO).lines[0]).toMatchObject({ qty: 3, label: "Pose de châssis PVC double vitrage 120 sur 135" });
    expect(parseQuote("Pour la villa Lambert à Waterloo, 120 m² de gazon en rouleaux", MO).client).toBe("Villa Lambert");
  });
});

describe("paroles parasites", () => {
  it("ne met jamais « j'aimerais bien », « il me faut »… dans le devis", () => {
    const got = (s: string) => parseQuote(s, MO).lines.map((l) => `${l.qty} ${l.unit} ${l.label}`);
    expect(got("Pour Magali, j’aimerais bien 24 m² de carrelage, il me faut, 4 mètres de tuyauterie et 2 kg de colle carrelage")).toEqual(["24 m² Carrelage", "4 ml Tuyauterie", "2 kg Colle carrelage"]);
    expect(got("J'aimerais bien de carrelage 24 m2, il me faut euh voilà, on a besoin de 3 robinets merci")).toEqual(["24 m² Carrelage", "3 u Robinets"]);
    expect(got("je voudrais aussi qu'on mette 12 mètres de plinthes s'il vous plaît, c'est tout")).toEqual(["12 ml Plinthes"]);
    expect(got("le client voudrait 2 mitigeurs, ensuite il faudrait 6 heures de main d'oeuvre, bon voilà")).toEqual(["2 u Mitigeurs", "6 h Main-d'œuvre"]);
    expect(got("il me faut, voilà, c'est tout, merci")).toEqual([]);
  });
});

describe("paroles parasites sans ponctuation (dictée iPhone)", () => {
  it("coupe la phrase sur « il me faut », « est-ce que tu peux mettre »… et les retire", () => {
    const got = (s: string) => parseQuote(s, MO).lines.map((l) => `${l.qty} ${l.unit} ${l.label}`);
    expect(got("pour Magali j'aimerais bien 24 m² de carrelage il me faut 4 mètres de tuyauterie et 2 kg de colle carrelage")).toEqual(["24 m² Carrelage", "4 ml Tuyauterie", "2 kg Colle carrelage"]);
    expect(got("j'aimerais bien de carrelage 24 m² il me faut aussi 4 mètres de tuyauterie")).toEqual(["24 m² Carrelage", "4 ml Tuyauterie"]);
    expect(got("je vais avoir besoin de 3 robinets et est-ce que tu peux mettre 2 sacs de ciment")).toEqual(["3 u Robinets", "2 sac Ciment"]);
    expect(got("ajoute-moi 12 m² de faïence donc on va mettre aussi 5 litres de primaire")).toEqual(["12 m² Faïence", "5 L Primaire"]);
    const r = parseQuote("alors pour le devis de monsieur Dupont il faudrait 10 m² de parquet je pense que c'est tout", MO);
    expect(r.client).toBe("M. Dupont");
    expect(r.lines.map((l) => `${l.qty} ${l.unit} ${l.label}`)).toEqual(["10 m² Parquet"]);
  });
});
