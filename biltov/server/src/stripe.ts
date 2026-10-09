// Stripe Billing via l'API REST (sans SDK : le Worker reste léger).
// Abonnements récurrents, TVA belge (taux de taxe 21 %), prorata, délai de grâce, annulation, dépassement Max.

import { GRACE_DAYS, type Cycle, type PlanId } from "../../lib/plans";
import type { Subscription } from "../../lib/billing/entitlement";

export interface StripeApi {
  request<T = Record<string, unknown>>(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<T>;
}

/** Encodage « formulaire » de Stripe : { a: { b: [1] } } → a[b][0]=1 */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? out.push(...formEncode(x as Record<string, unknown>, `${key}[${i}]`)) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`)));
    else if (typeof v === "object") out.push(...formEncode(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export function stripeApi(secretKey: string, fetchImpl: typeof fetch = fetch): StripeApi {
  return {
    async request(method, path, params) {
      const body = params ? formEncode(params).join("&") : undefined;
      const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
      const res = await fetchImpl(url, { method, headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: method === "GET" ? undefined : body });
      const json = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(`Stripe : ${json.error?.message ?? res.status}`);
      return json as never;
    },
  };
}

/** Vérifie l'en-tête Stripe-Signature (HMAC-SHA256, tolérance de 5 minutes). */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), tolerance = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(nowSec - t) > tolerance) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

export type Prices = Partial<Record<`${PlanId}_${Cycle}`, string>>;
export const priceIdFor = (prices: Prices, plan: PlanId, cycle: Cycle) => prices[`${plan}_${cycle}`] || null;
export function planFromPrice(prices: Prices, priceId: string | undefined): { plan: PlanId; cycle: Cycle } | null {
  const hit = Object.entries(prices).find(([, id]) => id && id === priceId);
  if (!hit) return null;
  const [plan, cycle] = hit[0].split("_") as [PlanId, Cycle];
  return { plan, cycle };
}

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  start_date?: number;
  ended_at?: number | null;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items: { data: { id: string; price: { id: string }; current_period_start?: number; current_period_end?: number }[] };
};

const isoSec = (s: number | undefined | null) => (s ? new Date(s * 1000).toISOString() : null);

/** Abonnement Stripe → abonnement Biltov (statut, forfait, période, délai de grâce). */
export function subscriptionFromStripe(prev: Subscription, s: StripeSubscription, prices: Prices, now = Date.now()): Subscription {
  const item = s.items.data[0];
  const pc = planFromPrice(prices, item?.price.id);
  const periodStart = isoSec(item?.current_period_start ?? s.current_period_start);
  const periodEnd = isoSec(item?.current_period_end ?? s.current_period_end);
  const base: Subscription = { ...prev, plan: pc?.plan ?? prev.plan, cycle: pc?.cycle ?? prev.cycle, periodStart, periodEnd, cancelAtPeriodEnd: s.cancel_at_period_end, startedAt: isoSec(s.start_date) ?? prev.startedAt };
  switch (s.status) {
    case "active":
    case "trialing":
      return { ...base, status: "active", graceUntil: null };
    case "past_due":
      return { ...base, status: "past_due", graceUntil: prev.graceUntil ?? new Date(now + GRACE_DAYS * 864e5).toISOString() };
    case "unpaid":
      return { ...base, status: "unpaid" };
    case "canceled":
      return { ...base, status: "canceled", periodEnd: isoSec(s.ended_at) ?? periodEnd };
    default:
      // incomplete, incomplete_expired, paused : premier paiement pas encore abouti → statut inchangé
      return { ...prev, cancelAtPeriodEnd: s.cancel_at_period_end };
  }
}
