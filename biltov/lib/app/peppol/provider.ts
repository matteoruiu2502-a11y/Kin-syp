// Abstraction de l'Access Point Peppol : un prestataire certifié s'y branche côté serveur
// (clé d'API jamais exposée au navigateur). Identifiant belge : schéma 0208 + numéro BCE.

import { isBeVat, normalizeBce } from "../../tax/belgium";
import type { Client } from "../types";

export type PeppolStatus = "queued" | "sent" | "delivered" | "error";

export interface PeppolProvider {
  readonly name: string;
  readonly configured: boolean;
  lookup(participantId: string): Promise<boolean>;
  send(xml: string, meta: { documentNumber: string; receiver: string }): Promise<{ id: string; status: PeppolStatus }>;
  status(id: string): Promise<{ status: PeppolStatus; message?: string }>;
}

export const participantId = (bce: string) => `0208:${normalizeBce(bce)}`;

/** Routage : assujetti belge → Peppol obligatoire ; particulier → PDF (e-mail, WhatsApp, SMS). */
export const requiresPeppol = (client: Pick<Client, "kind" | "vatNumber">) => client.kind === "assujetti" && isBeVat(client.vatNumber);

/** Prestataire par défaut tant qu'aucun Access Point n'est branché (serveur requis). */
export const notConfiguredProvider: PeppolProvider = {
  name: "Non configuré",
  configured: false,
  async lookup() {
    throw new Error("Aucun Access Point Peppol configuré.");
  },
  async send() {
    throw new Error("Aucun Access Point Peppol configuré : téléchargez le fichier UBL et déposez-le chez votre prestataire.");
  },
  async status() {
    return { status: "error", message: "Aucun Access Point Peppol configuré." };
  },
};

export const peppolProvider: PeppolProvider = notConfiguredProvider;
