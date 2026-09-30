import { describe, expect, it } from "vitest";
import { newArticle } from "../defaults";
import { applyArticlePlan, ARTICLE_FIELDS, autoMap, clientsFromParsed, CLIENT_FIELDS, decodeCsv, parseCsvText, parseNumber, planArticleImport, validateRows, normalizeUnit } from "./import";
import { bestMatch } from "./match";
import { bulkAdjust, costOf, indexArticles, saleOf, recalcAll } from "./pricing";

describe("nombres belges", () => {
  it.each([
    ["12,50", 12.5],
    ["12,50 €", 12.5],
    ["1.234,56", 1234.56],
    ["1 234,56 €", 1234.56],
    ["1,234.56", 1234.56],
    ["12.5", 12.5],
    ["1.000.000", 1000000],
    ["", null],
    ["abc", null],
  ])("%s → %s", (input, expected) => expect(parseNumber(input)).toBe(expected));
});

describe("lecture CSV", () => {
  it("séparateur ; et virgule décimale", () => {
    const t = parseCsvText("Référence;Désignation;Prix de vente\nA1;Carrelage;24,50\nA2;Colle;\"1.234,00\"");
    expect(t.headers).toEqual(["Référence", "Désignation", "Prix de vente"]);
    expect(t.rows[1]).toEqual(["A2", "Colle", "1.234,00"]);
  });
  it("Windows-1252 (accents d'un export Excel)", () => {
    const bytes = new Uint8Array([0x44, 0xe9, 0x73, 0x69, 0x67, 0x6e, 0x61, 0x74, 0x69, 0x6f, 0x6e]); // « Désignation » en cp1252
    expect(decodeCsv(bytes.buffer)).toBe("Désignation");
  });
  it("UTF-8 avec BOM", () => {
    const bytes = new TextEncoder().encode("﻿Réf");
    expect(decodeCsv(bytes.buffer as ArrayBuffer)).toBe("Réf");
  });
});

describe("mapping et validation", () => {
  it("auto-mapping FR / NL", () => {
    const map = autoMap(["Code article", "Omschrijving", "Eenheid", "Aankoopprijs", "Marge"], ARTICLE_FIELDS);
    expect(map).toMatchObject({ "Code article": "ref", Omschrijving: "name_nl", Eenheid: "unit", Aankoopprijs: "purchasePrice", Marge: "marginPercent" });
  });
  it("erreurs ligne par ligne", () => {
    const t = parseCsvText("Désignation;Prix d'achat\nCarrelage;24,50\n;10\nColle;abc");
    const { parsed, errors } = validateRows(t, autoMap(t.headers, ARTICLE_FIELDS), ARTICLE_FIELDS);
    expect(parsed).toHaveLength(1);
    expect(errors).toEqual([
      { row: 3, field: "Désignation FR", message: "Valeur obligatoire manquante" },
      { row: 4, field: "Prix d'achat HTVA", message: "Nombre invalide : « abc »" },
    ]);
  });
  it("unités normalisées", () => {
    expect(normalizeUnit("M2")).toBe("m²");
    expect(normalizeUnit("stuk")).toBe("u");
    expect(normalizeUnit("uur")).toBe("h");
  });
});

describe("import d'articles", () => {
  const existing = [newArticle({ ref: "A1", name: { fr: "Ancien", nl: "", de: "" }, purchasePrice: 10, marginPercent: 50 })];
  const t = parseCsvText("Référence;Désignation;Prix d'achat\nA1;Carrelage;20\nA2;Colle;8");
  const { parsed } = validateRows(t, autoMap(t.headers, ARTICLE_FIELDS), ARTICLE_FIELDS);
  it("doublon mis à jour : nouveau prix d'achat, marge conservée, vente recalculée, historique", () => {
    const plan = planArticleImport(parsed, existing, { duplicates: "update", supplierId: null, defaultMargin: 30, trade: "" });
    expect(plan.create).toHaveLength(1);
    expect(plan.update).toHaveLength(1);
    const out = applyArticlePlan(existing, plan);
    const a1 = out.find((a) => a.ref === "A1")!;
    expect(a1.purchasePrice).toBe(20);
    expect(a1.salePrice).toBe(30);
    expect(a1.priceHistory).toHaveLength(1);
    expect(out.find((a) => a.ref === "A2")!.salePrice).toBe(10.4);
  });
  it("doublon ignoré", () => {
    const plan = planArticleImport(parsed, existing, { duplicates: "skip", supplierId: null, defaultMargin: 30, trade: "" });
    expect(plan.skipped).toBe(1);
    expect(plan.update).toHaveLength(0);
  });
});

describe("ouvrages composés", () => {
  const tile = newArticle({ id: "t", purchasePrice: 20, marginPercent: 50 });
  const glue = newArticle({ id: "g", purchasePrice: 2, marginPercent: 100 });
  const mo = newArticle({ id: "m", purchasePrice: 30, marginPercent: 50, type: "labour" });
  const kit = newArticle({ id: "k", type: "package", components: [{ articleId: "t", qty: 1.1 }, { articleId: "g", qty: 1 }, { articleId: "m", qty: 0.5 }] });
  it("coût et prix calculés depuis les composants, recalculés si un composant change", () => {
    const idx = indexArticles([tile, glue, mo, kit]);
    expect(costOf(kit, idx)).toBe(39);
    expect(saleOf(kit, idx)).toBe(59.5);
    const after = recalcAll(bulkAdjust([tile, glue, mo, kit], new Set(["t"]), 10));
    expect(after.find((a) => a.id === "k")!.salePrice).toBe(62.8);
  });
});

describe("dictée ↔ catalogue", () => {
  const cat = [
    newArticle({ id: "p", name: { fr: "Pose parquet chêne massif", nl: "Plaatsing eiken parket", de: "" }, unit: "m²" }),
    newArticle({ id: "mo", name: { fr: "Main-d'œuvre menuisier", nl: "Arbeidsloon schrijnwerker", de: "" }, unit: "h" }),
    newArticle({ id: "pl", name: { fr: "Plinthe MDF blanche", nl: "", de: "" }, unit: "ml" }),
  ];
  it("trouve l'article malgré le jargon ou la langue", () => {
    expect(bestMatch("parquet chêne", cat)?.article.id).toBe("p");
    expect(bestMatch("eiken parket", cat)?.article.id).toBe("p");
    expect(bestMatch("plinthes", cat)?.article.id).toBe("pl");
    expect(bestMatch("heures de main d'œuvre", cat, { unit: "h" })?.article.id).toBe("mo");
  });
  it("rien d'inventé : pas de correspondance → null", () => expect(bestMatch("fenêtre triple vitrage", cat)).toBeNull());
});

describe("import de clients", () => {
  it("assujetti déduit du numéro de TVA", () => {
    const t = parseCsvText("Nom;TVA;Localité;Langue\nBouw NV;BE 0403.170.701;Gent;nl\nMme Dupont;;Namur;");
    const { parsed } = validateRows(t, autoMap(t.headers, CLIENT_FIELDS), CLIENT_FIELDS);
    const { create } = clientsFromParsed(parsed, [], "update");
    expect(create[0]).toMatchObject({ kind: "assujetti", vatNumber: "BE0403170701", lang: "nl", bce: "0403170701" });
    expect(create[1]).toMatchObject({ kind: "particulier", lang: "fr" });
  });
});
