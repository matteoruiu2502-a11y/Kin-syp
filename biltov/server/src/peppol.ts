// Abstraction du prestataire Peppol (Access Point). Le serveur est le seul à envoyer : il compte et limite.
// Changer de prestataire = écrire un nouvel adaptateur qui respecte AccessPoint, puis le sélectionner par PEPPOL_PROVIDER.

export type PeppolSend = { ubl: string; sender: string; receiver: string; documentNumber: string };
export type PeppolResult = { ok: true; id: string; status: "sent" | "delivered" } | { ok: false; error: string };

export interface AccessPoint {
  readonly name: string;
  send(doc: PeppolSend): Promise<PeppolResult>;
}

/** Simulation : accepte tout, n'envoie rien (tests et démonstration du parcours complet). */
export const simulationAccessPoint: AccessPoint = {
  name: "simulation",
  async send(doc) {
    if (!doc.ubl.includes("<Invoice") && !doc.ubl.includes("<CreditNote")) return { ok: false, error: "Document UBL invalide." };
    return { ok: true, id: `sim-${doc.documentNumber}-${Date.now().toString(36)}`, status: "sent" };
  },
};

/**
 * Adaptateur HTTP générique : POST JSON { sender, receiver, documentNumber, ubl (base64) } avec une clé d'API,
 * réponse attendue { id, status }. Chaque prestataire a sa propre API : adaptez ce corps de requête
 * à celle du prestataire choisi (quelques lignes) avant la mise en production.
 */
export function httpAccessPoint(url: string, apiKey: string, fetchImpl: typeof fetch = fetch): AccessPoint {
  return {
    name: "http",
    async send(doc) {
      try {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ sender: doc.sender, receiver: doc.receiver, documentNumber: doc.documentNumber, ubl: btoa(unescape(encodeURIComponent(doc.ubl))) }),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; message?: string };
        if (!res.ok || !json.id) return { ok: false, error: json.message || `Prestataire Peppol : erreur ${res.status}` };
        return { ok: true, id: json.id, status: json.status === "delivered" ? "delivered" : "sent" };
      } catch (e) {
        return { ok: false, error: `Prestataire Peppol injoignable : ${(e as Error).message}` };
      }
    },
  };
}
