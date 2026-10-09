// Préférences du mode 3D et détection des capacités de l'appareil.
// Aucun import de Three.js ici : ce fichier est chargé avec l'espace artisan, même en mode normal.

const KEY = "biltov.mode3d";

/** Clé de stockage propre à l'utilisateur (compte + personne connectée sur l'appareil). */
const keyFor = (accountId: string, memberId: string | null) => `${KEY}.${accountId}.${memberId ?? "owner"}`;

/** Mode mémorisé ; le mode normal est le mode par défaut (stockage indisponible → normal). */
export function readMode(accountId: string, memberId: string | null): boolean {
  try {
    return localStorage.getItem(keyFor(accountId, memberId)) === "3d";
  } catch {
    return false;
  }
}

export function writeMode(accountId: string, memberId: string | null, on: boolean) {
  try {
    localStorage.setItem(keyFor(accountId, memberId), on ? "3d" : "normal");
  } catch {}
}

/** Ambiance (nuages, fumée, silhouettes) : désactivable, mémorisée par appareil. */
export function readAmbiance(): boolean {
  try {
    const v = localStorage.getItem(`${KEY}.ambiance`);
    if (v === "on" || v === "off") return v === "on";
  } catch {}
  // par défaut : activée sur ordinateur, coupée sur écran tactile (batterie)
  return typeof matchMedia === "function" && !matchMedia("(pointer: coarse)").matches;
}

export function writeAmbiance(on: boolean) {
  try {
    localStorage.setItem(`${KEY}.ambiance`, on ? "on" : "off");
  } catch {}
}

export type Unsupported = "webgl" | "motion" | "slow";

export const UNSUPPORTED_TEXT: Record<Unsupported, string> = {
  webgl: "Mode 3D indisponible : ce navigateur ne gère pas la 3D (WebGL). Affichage normal.",
  motion: "Mode 3D désactivé : vous avez choisi de réduire les animations. Affichage normal.",
  slow: "Mode 3D désactivé : cet appareil est trop lent pour l'afficher confortablement. Affichage normal.",
};

let webgl: boolean | null = null;

/** WebGL disponible ? Le contexte de test est libéré aussitôt. */
function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
    webgl = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Raison pour laquelle la 3D ne peut pas s'afficher (null = possible). */
export function unsupportedReason(): Unsupported | null {
  if (typeof window === "undefined") return null;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "motion";
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.deviceMemory !== undefined && nav.deviceMemory < 2) || (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 2)) return "slow";
  if (!hasWebGL()) return "webgl";
  return null;
}
