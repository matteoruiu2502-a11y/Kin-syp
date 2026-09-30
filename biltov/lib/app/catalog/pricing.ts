// Prix du catalogue : vente = achat × (1 + marge), sauf prix forcé ; ouvrages = somme des composants.

import { round2 } from "../money";
import type { Article, PriceList } from "../types";

export const computedSale = (a: Pick<Article, "purchasePrice" | "marginPercent">) => round2(a.purchasePrice * (1 + a.marginPercent / 100));

type Index = Map<string, Article>;
export const indexArticles = (list: Article[]): Index => new Map(list.map((a) => [a.id, a]));

/** Prix de revient (achat) d'un article ou d'un ouvrage, récursif, protégé contre les cycles. */
export function costOf(a: Article, idx: Index, seen = new Set<string>()): number {
  if (!a.components.length) return a.purchasePrice;
  if (seen.has(a.id)) return 0;
  seen.add(a.id);
  return round2(a.components.reduce((s, c) => s + (idx.get(c.articleId) ? costOf(idx.get(c.articleId)!, idx, new Set(seen)) * c.qty : 0), 0));
}

/** Prix de vente HTVA : forcé, ou marge sur le coût (ouvrage : somme des ventes des composants). */
export function saleOf(a: Article, idx: Index, seen = new Set<string>()): number {
  if (a.salePriceForced) return a.salePrice;
  if (!a.components.length) return computedSale(a);
  if (seen.has(a.id)) return 0;
  seen.add(a.id);
  return round2(a.components.reduce((s, c) => s + (idx.get(c.articleId) ? saleOf(idx.get(c.articleId)!, idx, new Set(seen)) * c.qty : 0), 0));
}

/** Recalcule le prix de vente stocké de tous les articles (après import ou modification d'un composant). */
export function recalcAll(list: Article[]): Article[] {
  const idx = indexArticles(list);
  return list.map((a) => {
    const sale = saleOf(a, idx);
    const cost = costOf(a, idx);
    return sale === a.salePrice && (a.components.length ? cost === a.purchasePrice : true) ? a : { ...a, salePrice: sale, purchasePrice: a.components.length ? cost : a.purchasePrice };
  });
}

/** Prix après grille tarifaire du client (remise générale ou par famille). */
export function priceForList(price: number, family: string, list: PriceList | undefined) {
  if (!list) return price;
  const pct = list.familyDiscounts[family] ?? list.discountPercent;
  return round2(price * (1 - pct / 100));
}

/** Modification en masse : hausse / baisse en %. */
export const bulkAdjust = (list: Article[], ids: Set<string>, percent: number, field: "purchasePrice" | "salePrice" = "purchasePrice") =>
  recalcAll(
    list.map((a) =>
      ids.has(a.id) ? { ...a, [field]: round2(a[field] * (1 + percent / 100)), salePriceForced: field === "salePrice" ? true : a.salePriceForced, priceHistory: [...a.priceHistory, { at: new Date().toISOString().slice(0, 10), purchase: a.purchasePrice, sale: a.salePrice }] } : a,
    ),
  );
