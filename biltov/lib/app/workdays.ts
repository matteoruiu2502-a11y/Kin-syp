// Calendrier de travail belge : jours fériés légaux, week-ends et congés du bâtiment.
// Les dates sont des chaînes AAAA-MM-JJ (fuseau Europe/Bruxelles implicite : aucune heure).

import type { PlanningSettings } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Ajoute des jours calendaires (midi UTC : pas de piège à l'heure d'été). */
export const plusDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Nombre de jours calendaires de a à b (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);

/** Lundi = 0 … dimanche = 6 (la semaine commence le lundi). */
export const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
export const isWeekend = (day: string) => weekday(day) >= 5;

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher, calendrier grégorien). */
export function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

const cache = new Map<number, Map<string, string>>();

/** Les 10 jours fériés légaux en Belgique (date → nom). */
export function belgianHolidays(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const e = easter(year);
  const out = new Map<string, string>([
    [iso(year, 1, 1), "Nouvel An"],
    [plusDays(e, 1), "Lundi de Pâques"],
    [iso(year, 5, 1), "Fête du Travail"],
    [plusDays(e, 39), "Ascension"],
    [plusDays(e, 50), "Lundi de Pentecôte"],
    [iso(year, 7, 21), "Fête nationale"],
    [iso(year, 8, 15), "Assomption"],
    [iso(year, 11, 1), "Toussaint"],
    [iso(year, 11, 11), "Armistice"],
    [iso(year, 12, 25), "Noël"],
  ]);
  cache.set(year, out);
  return out;
}

export const holidayName = (day: string) => belgianHolidays(Number(day.slice(0, 4))).get(day) ?? null;

type Cal = Pick<PlanningSettings, "constructionLeaves"> | undefined;

/** Congé du bâtiment qui couvre ce jour. */
export const leaveOn = (day: string, cal: Cal) => cal?.constructionLeaves.find((l) => l.start <= day && day <= l.end) ?? null;

/** Ce qui rend un jour non ouvrable (null = jour ouvrable). */
export function dayOff(day: string, cal: Cal): { kind: "weekend" | "holiday" | "leave"; label: string } | null {
  const h = holidayName(day);
  if (h) return { kind: "holiday", label: h };
  const l = leaveOn(day, cal);
  if (l) return { kind: "leave", label: l.label };
  if (isWeekend(day)) return { kind: "weekend", label: weekday(day) === 5 ? "Samedi" : "Dimanche" };
  return null;
}

export const isWorkday = (day: string, cal: Cal) => !dayOff(day, cal);

/** Jours de a à b inclus. */
export const eachDay = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = a; d <= b && out.length < 3700; d = plusDays(d, 1)) out.push(d);
  return out;
};

/** Jours ouvrables entre a et b inclus. */
export const workdaysIn = (a: string, b: string, cal: Cal) => eachDay(a, b).filter((d) => isWorkday(d, cal));

/** Décale une date de n jours ouvrables (n peut être négatif ; 0 = premier jour ouvrable ≥ date). */
export function addWorkdays(day: string, n: number, cal: Cal) {
  let d = day;
  while (!isWorkday(d, cal)) d = plusDays(d, 1);
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0; ) {
    d = plusDays(d, step);
    if (isWorkday(d, cal)) left--;
  }
  return d;
}
