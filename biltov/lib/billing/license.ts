// Licence d'abonnement : l'état de l'abonnement signé par le serveur (ECDSA P-256, SHA-256).
// L'application vérifie la signature avec la clé publique : impossible de s'attribuer un forfait sans le serveur.
// Format : base64url(JSON) + "." + base64url(signature). Partagé par l'application et le serveur.

import type { Subscription, Usage } from "./entitlement";

export type LicensePayload = { v: 1; acc: string; sub: Subscription; usage: Usage | null; iat: number; exp: number };

/** Durée de validité d'une licence (le serveur en délivre une nouvelle à chaque ouverture en ligne). */
export const LICENSE_TTL_DAYS = 7;
/** Hors ligne : jours de tolérance après expiration de la licence avant le passage en lecture seule. */
export const OFFLINE_GRACE_DAYS = 7;

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN = { name: "ECDSA", hash: "SHA-256" } as const;

export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Contenu d'une licence, sans vérification (affichage uniquement). */
export function decodeLicense(token: string): LicensePayload | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromB64url(token.split(".")[0])));
  } catch {
    return null;
  }
}

/** Signature (serveur) avec la clé privée PKCS#8 encodée en base64. */
export async function signLicense(payload: LicensePayload, privateKeyB64: string): Promise<string> {
  const key = await crypto.subtle.importKey("pkcs8", fromB64(privateKeyB64), ALG, false, ["sign"]);
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign(SIGN, key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** Vérification (application) avec la clé publique SPKI encodée en base64. Renvoie null si invalide. */
export async function verifyLicense(token: string, publicKeyB64: string): Promise<LicensePayload | null> {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const key = await crypto.subtle.importKey("spki", fromB64(publicKeyB64), ALG, false, ["verify"]);
    const ok = await crypto.subtle.verify(SIGN, key, fromB64url(sig), new TextEncoder().encode(body));
    return ok ? decodeLicense(token) : null;
  } catch {
    return null;
  }
}
