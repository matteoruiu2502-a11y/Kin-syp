// Dictée → lignes de devis, en cherchant d'abord dans le catalogue de l'artisan.
// Aucun prix n'est inventé : sans prix dicté ni article trouvé, la ligne est « à chiffrer ».

import type { ParsedLine, ParsedQuote } from "../../parseQuote";
import { newLine } from "../defaults";
import type { Article, Lang, Line, PriceList } from "../types";
import { ambiguousMatches, rankMatches, type Match } from "./match";
import { priceForList } from "./pricing";

/** Unités « de mesure » : sans quantité dictée, il faut la demander (« combien de mètres ? »). */
export const MEASURE_UNITS = ["ml", "m²", "m³", "kg", "h", "j", "L", "t"];
/** Produits vendus au mètre, au m² ou au poids : sans quantité dictée, la longueur ou la surface est à demander. */
const MEASURE_NOUNS = /\b(?:tuyau|tuyaux|tube|tubes|c[âa]ble|c[âa]bles|gaine|gaines|fil|fils|goulotte|plinthe|plinthes|carrelage|fa[ïi]ence|parquet|stratifi[ée]|peinture|enduit|isolation|isolant|b[ée]ton|sable|gravier|ciment|chape|cloison|plaque|plaques|gazon|terre|paillis|haie|haies|bordure|bordures|pav[ée]s|dalles?|moquette|rev[êe]tement|canalisation|descente|goutti[èe]re|rail|profil[ée]s?|baguette|joint)\b/i;

export type DictatedLine = {
  line: Line;
  spoken: string; // ce que l'artisan a dit pour cette ligne
  choices: Match[] | null; // plusieurs articles également plausibles : à choisir
  qtyMissing: boolean; // quantité non dictée pour une unité de mesure
};

/** Ligne de devis construite depuis un article du catalogue et ce qui a été dicté (quantité, unité, prix). */
export function lineFromArticle(a: Article, p: Pick<ParsedLine, "qty" | "unit" | "price" | "priceGiven" | "unitAmbiguous">, lang: Lang, priceList: PriceList | undefined, confidence: number): Line {
  return newLine({
    articleId: a.id,
    label: a.name[lang] || a.name.fr,
    qty: p.qty,
    // unité de l'article sauf si une unité précise a été dictée (« mètres » seul reste ambigu : ml ou m² selon le produit)
    unit: p.unit === "u" || p.unitAmbiguous ? a.unit : p.unit,
    unitPrice: p.priceGiven ? p.price : priceForList(a.salePrice, a.family, priceList),
    category: a.category,
    costPrice: a.purchasePrice,
    confidence,
  });
}

/** Dictée → lignes, avec les cas à clarifier (choix entre plusieurs articles, quantité manquante). */
export function dictationToDetailedLines(parsed: ParsedQuote, articles: Article[], lang: Lang, priceList?: PriceList, trade?: string): DictatedLine[] {
  return parsed.lines.map((p) => {
    const ranked = rankMatches(p.label, articles, { unit: p.unit, unitAmbiguous: p.unitAmbiguous, trade });
    const m = ranked[0];
    if (m) {
      const line = lineFromArticle(m.article, p, lang, priceList, m.confidence);
      return { line, spoken: p.label, choices: ambiguousMatches(ranked, 0.08, trade), qtyMissing: !p.qtyGiven && MEASURE_UNITS.includes(line.unit) };
    }
    const line = newLine({ label: p.label, qty: p.qty, unit: p.unit, unitPrice: p.priceGiven ? p.price : 0, toPrice: !p.priceGiven, confidence: 0, category: p.unit === "h" ? "labour" : "installed_material" });
    return { line, spoken: p.label, choices: null, qtyMissing: !p.qtyGiven && (MEASURE_UNITS.includes(line.unit) || MEASURE_NOUNS.test(p.label)) };
  });
}

export function dictationToLines(parsed: ParsedQuote, articles: Article[], lang: Lang, priceList?: PriceList): Line[] {
  return dictationToDetailedLines(parsed, articles, lang, priceList).map((d) => d.line);
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
