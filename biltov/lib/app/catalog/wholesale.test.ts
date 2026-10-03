import { describe, expect, it } from "vitest";
import { newArticle } from "../defaults";
import { bestMatch } from "./match";
import { ARTICLE_FIELDS, autoMap, parseCsvText, planArticleImport, validateRows } from "./import";

describe("catalogues grossistes", () => {
  it("prix brut − remise = prix d'achat net", () => {
    const table = parseCsvText("Code article;Libellé;Unité;Prix brut;Remise %\nCEB-1;Disjoncteur 16A;pce;20,00;35");
    const map = autoMap(table.headers, ARTICLE_FIELDS);
    expect(map["Prix brut"]).toBe("listPrice");
    expect(map["Remise %"]).toBe("discountPercent");
    const { parsed } = validateRows(table, map, ARTICLE_FIELDS);
    const plan = planArticleImport(parsed, [], { duplicates: "update", supplierId: null, defaultMargin: 30, trade: "electricien" });
    expect(plan.create[0].purchasePrice).toBe(13);
  });
  it("retrouve un article dans un catalogue de 20 000 références (index)", () => {
    const arts = Array.from({ length: 20000 }, (_, i) => newArticle({ ref: `REF-${i}`, name: { fr: `Article générique ${i} variante ${i % 37}`, nl: "", de: "" } }));
    arts[12345] = newArticle({ ref: "CEB-12345", name: { fr: "Disjoncteur différentiel 30 mA type A 40 A", nl: "Verliesstroomschakelaar 30 mA", de: "" } });
    const t0 = Date.now();
    const m = bestMatch("différentiel 30 mA", arts);
    expect(m?.article.ref).toBe("CEB-12345");
    expect(bestMatch("verliesstroomschakelaar", arts)?.article.ref).toBe("CEB-12345");
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
