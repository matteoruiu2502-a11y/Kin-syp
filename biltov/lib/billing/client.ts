// Client du serveur d'abonnement (server/). Sans adresse configurée : mode local (essai local, aucun paiement).

import type { Cycle, PlanId } from "../plans";

export const BILLING_API = (process.env.NEXT_PUBLIC_BILLING_API_URL || "").replace(/\/$/, "");
export const BILLING_PUBLIC_KEY = process.env.NEXT_PUBLIC_BILLING_PUBLIC_KEY || "";
/** Serveur d'abonnement branché (adresse + clé publique de vérification des licences). */
export const billingConfigured = !!(BILLING_API && BILLING_PUBLIC_KEY);

export class BillingError extends Error {
  constructor(public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

export type Creds = { accountId: string; secret: string };
export type BillingInvoice = { id: string; number: string | null; date: string; totalTTC: number; status: string; url: string | null; pdf: string | null };

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BILLING_API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new BillingError("offline");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new BillingError(String(json.error ?? res.status), json);
  return json as T;
}

export const billingApi = {
  register: (c: Creds, p: { email: string; bce: string; createdAt: string }) => post<{ license: string }>("/v1/register", { ...c, ...p }),
  license: (c: Creds) => post<{ license: string }>("/v1/license", c),
  checkout: (c: Creds, plan: PlanId, cycle: Cycle) => post<{ url: string }>("/v1/checkout", { ...c, plan, cycle }),
  change: (c: Creds, plan: PlanId, cycle: Cycle) => post<{ license: string }>("/v1/subscription/change", { ...c, plan, cycle }),
  cancel: (c: Creds, resume = false) => post<{ license: string }>("/v1/subscription/cancel", { ...c, resume }),
  portal: (c: Creds) => post<{ url: string }>("/v1/portal", c),
  invoices: (c: Creds) => post<{ invoices: BillingInvoice[] }>("/v1/invoices", c),
  peppolSend: (c: Creds, p: { docId: string; documentNumber: string; receiver: string; ubl: string }) => post<{ id: string; status: string; overage?: boolean; already?: boolean; license: string }>("/v1/peppol/send", { ...c, ...p }),
};
