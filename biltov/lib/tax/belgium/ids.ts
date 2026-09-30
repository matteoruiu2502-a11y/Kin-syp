// Identifiants belges : numéro d'entreprise BCE/KBO, TVA BE, communication structurée.
// Tous reposent sur un contrôle modulo 97.

const digits = (s: string) => s.replace(/\D/g, "");

/** Numéro d'entreprise : 10 chiffres (0 ou 1 en tête), les 2 derniers = 97 − (8 premiers mod 97). */
export function normalizeBce(input: string) {
  let d = digits(input);
  if (d.length === 9) d = `0${d}`; // anciens numéros à 9 chiffres
  return d;
}

export function isBce(input: string) {
  const d = normalizeBce(input);
  if (!/^[01]\d{9}$/.test(d)) return false;
  return 97 - (Number(d.slice(0, 8)) % 97) === Number(d.slice(8));
}

export const formatBce = (input: string) => {
  const d = normalizeBce(input);
  return d.length === 10 ? `${d.slice(0, 4)}.${d.slice(4, 7)}.${d.slice(7)}` : input;
};

/** TVA belge : « BE » + numéro d'entreprise. */
export const vatFromBce = (bce: string) => (isBce(bce) ? `BE${normalizeBce(bce)}` : "");
export const isBeVat = (vat: string) => /^BE[01]\d{9}$/.test(vat.replace(/[\s.]/g, "").toUpperCase()) && isBce(vat.slice(2));
export const formatBeVat = (vat: string) => {
  const v = vat.replace(/[\s.]/g, "").toUpperCase();
  return isBeVat(v) ? `BE ${formatBce(v.slice(2))}` : vat;
};

/** Communication structurée +++123/4567/89012+++ : 10 chiffres + contrôle (mod 97, 0 → 97). */
export function structuredCommunication(base: number | string) {
  const b = digits(String(base)).slice(-10).padStart(10, "0");
  const check = Number(BigInt(b) % 97n) || 97;
  const all = b + String(check).padStart(2, "0");
  return `+++${all.slice(0, 3)}/${all.slice(3, 7)}/${all.slice(7)}+++`;
}

export function isStructuredCommunication(input: string) {
  const d = digits(input);
  if (d.length !== 12) return false;
  const check = Number(BigInt(d.slice(0, 10)) % 97n) || 97;
  return check === Number(d.slice(10));
}

/** Communication dérivée du numéro de facture (ex. F-2026-0042 → 2026000042). */
export const communicationForInvoice = (number: string) => {
  const m = number.match(/(\d{4})\D*(\d+)$/);
  return structuredCommunication(m ? `${m[1]}${m[2].padStart(6, "0")}` : digits(number));
};

export function isIban(v: string) {
  const s = v.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  if (s.startsWith("BE") && s.length !== 16) return false;
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of moved) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}
