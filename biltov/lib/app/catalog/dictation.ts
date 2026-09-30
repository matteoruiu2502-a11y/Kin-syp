// Dictée → lignes de devis, en cherchant d'abord dans le catalogue de l'artisan.
// Aucun prix n'est inventé : sans prix dicté ni article trouvé, la ligne est « à chiffrer ».

import type { ParsedQuote } from "../../parseQuote";
import { newLine } from "../defaults";
import type { Article, Lang, Line, PriceList } from "../types";
import { bestMatch } from "./match";
import { priceForList } from "./pricing";

export function dictationToLines(parsed: ParsedQuote, articles: Article[], lang: Lang, priceList?: PriceList): Line[] {
  return parsed.lines.map((p) => {
    const m = bestMatch(p.label, articles, { unit: p.unit });
    if (m) {
      const a = m.article;
      return newLine({
        articleId: a.id,
        label: a.name[lang] || a.name.fr,
        qty: p.qty,
        unit: p.unit === "u" && a.unit !== "u" ? a.unit : p.unit,
        unitPrice: p.priceGiven ? p.price : priceForList(a.salePrice, a.family, priceList),
        category: a.category,
        costPrice: a.purchasePrice,
        confidence: m.confidence,
      });
    }
    return newLine({ label: p.label, qty: p.qty, unit: p.unit, unitPrice: p.priceGiven ? p.price : 0, toPrice: !p.priceGiven, confidence: 0, category: p.unit === "h" ? "labour" : "installed_material" });
  });
}

/** Ouvrages liés aux articles présents et pas encore dans le devis (anti-oubli). */
export function relatedSuggestions(lines: Line[], articles: Article[]) {
  const present = new Set(lines.map((l) => l.articleId).filter(Boolean));
  const ids = new Set<string>();
  for (const l of lines) {
    const a = articles.find((x) => x.id === l.articleId);
    a?.related.forEach((r) => !present.has(r) && ids.add(r));
  }
  return articles.filter((a) => ids.has(a.id) && a.active);
}

export function articleToLine(a: Article, lang: Lang, priceList?: PriceList, qty = 1): Line {
  return newLine({ articleId: a.id, label: a.name[lang] || a.name.fr, qty, unit: a.unit, unitPrice: priceForList(a.salePrice, a.family, priceList), category: a.category, costPrice: a.purchasePrice });
}
