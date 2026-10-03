// Planning : semaines, conflits d'affectation, export agenda (.ics) et météo (Open-Meteo, sans clé).

import type { AccountData, PlanningEvent } from "./types";

export const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wd);
  return d.toISOString().slice(0, 10);
};

export const weekDays = (monday: string) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${monday}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

/** L'événement couvre-t-il ce jour (AAAA-MM-JJ) ? */
export const onDay = (e: PlanningEvent, day: string) => e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day;

const overlaps = (a: PlanningEvent, b: PlanningEvent) => a.start < b.end && b.start < a.end;

/** Conflits : même personne ou même véhicule sur deux événements qui se chevauchent (congés compris). */
export function conflicts(d: AccountData, e: PlanningEvent) {
  return d.events
    .filter((x) => x.id !== e.id && x.status !== "cancelled" && x.status !== "refused" && overlaps(x, e))
    .flatMap((x) => [
      ...x.memberIds.filter((m) => e.memberIds.includes(m)).map((memberId) => ({ memberId, vehicleId: null as string | null, event: x })),
      ...(x.vehicleIds ?? []).filter((v) => (e.vehicleIds ?? []).includes(v)).map((vehicleId) => ({ memberId: null as string | null, vehicleId, event: x })),
    ]);
}

export type PlanningRow = { type: "member" | "vehicle" | "none"; id: string };

const shiftDay = (dt: string, days: number) => {
  const d = new Date(`${dt.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.toISOString().slice(0, 10)}${dt.slice(10)}`;
};

/** Glisser-déposer : déplace l'événement d'un jour à l'autre et le réaffecte à la ligne d'arrivée. */
export function moveEvent(e: PlanningEvent, from: { row: PlanningRow; day: string }, to: { row: PlanningRow; day: string }): PlanningEvent {
  const delta = Math.round((Date.parse(`${to.day}T12:00:00Z`) - Date.parse(`${from.day}T12:00:00Z`)) / 864e5);
  let memberIds = e.memberIds;
  let vehicleIds = e.vehicleIds ?? [];
  if (from.row.type === "member") memberIds = memberIds.filter((m) => m !== from.row.id);
  if (from.row.type === "vehicle") vehicleIds = vehicleIds.filter((v) => v !== from.row.id);
  if (to.row.type === "member" && !memberIds.includes(to.row.id)) memberIds = [...memberIds, to.row.id];
  if (to.row.type === "vehicle" && !vehicleIds.includes(to.row.id)) vehicleIds = [...vehicleIds, to.row.id];
  // déposer depuis « non assigné » sur une ligne véhicule ne retire personne ; vers « non assigné » : retire la ressource d'origine
  return { ...e, start: shiftDay(e.start, delta), end: shiftDay(e.end, delta), memberIds, vehicleIds };
}

const icsDate = (s: string) => s.replace(/[-:]/g, "").slice(0, 13).padEnd(13, "0") + "00";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Fichier iCalendar importable dans Google Agenda, Outlook, Apple Calendrier. */
export function toIcs(events: PlanningEvent[], d: AccountData) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Biltov//Planning//FR", "CALSCALE:GREGORIAN"];
  for (const e of events) {
    const job = d.jobs.find((j) => j.id === e.jobId);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@biltov`,
      `DTSTAMP:${icsDate(new Date().toISOString().slice(0, 16))}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(job?.siteAddress ? [`LOCATION:${esc(job.siteAddress)}`] : []),
      ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export type DayWeather = { date: string; code: number; rain: number; tmax: number; wind: number };

/** Prévisions à 7 jours pour une localité belge (Open-Meteo : gratuit, sans clé, appelé depuis le navigateur). */
export async function fetchWeather(city: string, postcode = ""): Promise<DayWeather[]> {
  const q = encodeURIComponent(city || postcode);
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=5&language=fr&countryCode=BE`).then((r) => r.json());
  const place = geo?.results?.[0];
  if (!place) return [];
  const w = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weathercode,precipitation_sum,temperature_2m_max,windspeed_10m_max&timezone=Europe%2FBrussels`,
  ).then((r) => r.json());
  const daily = w?.daily;
  if (!daily?.time) return [];
  return daily.time.map((date: string, i: number) => ({ date, code: daily.weathercode[i], rain: daily.precipitation_sum[i], tmax: daily.temperature_2m_max[i], wind: daily.windspeed_10m_max[i] }));
}

/** Journée défavorable aux travaux extérieurs : pluie, gel, vent fort. */
export const badWeather = (w: DayWeather) => w.rain >= 5 || w.tmax <= 2 || w.wind >= 50 || [65, 67, 75, 82, 86, 95, 96, 99].includes(w.code);
