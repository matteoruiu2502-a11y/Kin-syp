// Intempéries : jours de chantier interrompus ou ralentis par la météo, avec preuve.
// La preuve officielle est le document IRM joint par l'utilisateur ; les relevés Open-Meteo ne sont
// qu'indicatifs (pré-remplissage) et le module fonctionne entièrement sans connexion.

import { uid } from "./defaults";
import { daysBetween, eachDay, workdaysIn } from "./workdays";
import type { AccountData, Job, PlanningSettings, WeatherDay, WeatherDuration, WeatherImpact, WeatherKind, WeatherStatus } from "./types";

export const WEATHER_KINDS: WeatherKind[] = ["rain", "heavy_rain", "storm", "frost", "snow", "ice", "wind", "heat", "fog", "other"];
export const KIND_LABEL: Record<WeatherKind, string> = {
  rain: "Pluie",
  heavy_rain: "Forte pluie",
  storm: "Orage",
  frost: "Gel",
  snow: "Neige",
  ice: "Verglas",
  wind: "Vent fort",
  heat: "Canicule",
  fog: "Brouillard",
  other: "Autre",
};
export const IMPACT_LABEL: Record<WeatherImpact, string> = { stop: "Arrêt total", slowed: "Travail ralenti", indoor: "Travaux intérieurs seulement" };
export const DURATION_LABEL: Record<WeatherDuration, string> = { full: "Journée complète", half: "Demi-journée", hours: "Heures précises" };
export const STATUS_LABEL: Record<WeatherStatus | "to_justify", string> = { to_justify: "À justifier", draft: "Brouillon", justified: "Justifié", validated: "Validé" };

/** Part de la journée réellement perdue selon l'impact (les heures restent modifiables à la main). */
const IMPACT_FACTOR: Record<WeatherImpact, number> = { stop: 1, slowed: 0.5, indoor: 0 };

const timeToH = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return Number.isFinite(h) ? h + (m || 0) / 60 : NaN;
};

type Cal = PlanningSettings | undefined;

/** Jours ouvrables concernés (au moins un jour, même si l'intempérie tombe un samedi). */
export const weatherWorkdays = (w: Pick<WeatherDay, "start" | "end">, cal: Cal) => Math.max(1, workdaysIn(w.start, w.end || w.start, cal).length);

/** Part d'une journée perdue par jour ouvrable (0 à 1), avant le facteur d'impact. */
export function dayShare(w: Pick<WeatherDay, "duration" | "fromTime" | "toTime">, hoursPerDay: number) {
  if (w.duration === "full") return 1;
  if (w.duration === "half") return 0.5;
  const h = timeToH(w.toTime) - timeToH(w.fromTime);
  return Number.isFinite(h) && h > 0 ? Math.min(1, h / hoursPerDay) : 0;
}

/** Heures perdues (heures × ouvriers impactés ; une équipe d'au moins une personne). */
export function computeHoursLost(w: Pick<WeatherDay, "start" | "end" | "duration" | "fromTime" | "toTime" | "impact" | "memberIds">, cal: Cal) {
  const hpd = cal?.hoursPerDay || 8;
  const perDay = dayShare(w, hpd) * hpd * IMPACT_FACTOR[w.impact];
  return Math.round(perDay * weatherWorkdays(w, cal) * Math.max(1, w.memberIds.length) * 100) / 100;
}

/** Jours de retard imputables à la météo (jours ouvrables × part perdue). */
export function delayDays(w: WeatherDay, cal: Cal) {
  return Math.round(weatherWorkdays(w, cal) * dayShare(w, cal?.hoursPerDay || 8) * IMPACT_FACTOR[w.impact] * 100) / 100;
}

/** Statut affiché : un jour sans preuve est « à justifier », quel que soit son statut. */
export const displayStatus = (w: WeatherDay): WeatherStatus | "to_justify" => (w.status === "validated" ? "validated" : w.proofs.length ? "justified" : "to_justify");

/** Statut enregistré après une modification : la preuve fait passer de brouillon à justifié (et l'inverse). */
export const nextStatus = (w: WeatherDay): WeatherStatus => (w.status === "validated" && w.proofs.length ? "validated" : w.proofs.length ? "justified" : "draft");

export const needsProof = (w: WeatherDay) => displayStatus(w) === "to_justify";

export const coversDay = (w: Pick<WeatherDay, "start" | "end">, day: string) => w.start <= day && day <= (w.end || w.start);

/** Compteurs d'un chantier. */
export function jobWeatherSummary(d: Pick<AccountData, "weatherDays" | "settings">, jobId: string) {
  const list = d.weatherDays.filter((w) => w.jobIds.includes(jobId));
  const cal = d.settings.planning;
  const days = new Set(list.flatMap((w) => eachDay(w.start, w.end || w.start)));
  return {
    count: list.length,
    days: days.size,
    delay: Math.round(list.reduce((s, w) => s + delayDays(w, cal), 0) * 10) / 10,
    hours: Math.round(list.reduce((s, w) => s + w.hoursLost, 0) * 10) / 10,
    justified: list.filter((w) => !needsProof(w)).length,
    toJustify: list.filter(needsProof).length,
  };
}

export function newWeatherDay(p: Partial<WeatherDay> & Pick<WeatherDay, "start" | "createdBy">): WeatherDay {
  const now = new Date().toISOString();
  return {
    id: uid(),
    jobIds: [],
    end: p.start,
    kind: "rain",
    duration: "full",
    fromTime: "08:00",
    toTime: "12:00",
    impact: "stop",
    memberIds: [],
    hoursLost: 0,
    measures: { rainMm: null, tMin: null, tMax: null, windKmh: null, source: "" },
    proofs: [],
    photoIds: [],
    comment: "",
    status: "draft",
    validatedBy: null,
    createdAt: now,
    createdById: null,
    history: [],
    ...p,
  };
}

/** Résumé lisible des changements entre deux versions (journal). */
export function describeChanges(a: WeatherDay, b: WeatherDay, names: { job: (id: string) => string; member: (id: string) => string }) {
  const out: string[] = [];
  const list = (ids: string[], f: (id: string) => string) => ids.map(f).join(", ") || "—";
  if (a.start !== b.start || a.end !== b.end) out.push(`dates ${a.start}${a.end !== a.start ? `→${a.end}` : ""} ⇒ ${b.start}${b.end !== b.start ? `→${b.end}` : ""}`);
  if (a.jobIds.join() !== b.jobIds.join()) out.push(`chantiers : ${list(b.jobIds, names.job)}`);
  if (a.kind !== b.kind) out.push(`type : ${KIND_LABEL[a.kind]} ⇒ ${KIND_LABEL[b.kind]}`);
  if (a.duration !== b.duration || a.fromTime !== b.fromTime || a.toTime !== b.toTime) out.push(`durée : ${DURATION_LABEL[b.duration]}${b.duration === "hours" ? ` ${b.fromTime}–${b.toTime}` : ""}`);
  if (a.impact !== b.impact) out.push(`impact : ${IMPACT_LABEL[b.impact]}`);
  if (a.memberIds.join() !== b.memberIds.join()) out.push(`ouvriers : ${list(b.memberIds, names.member)}`);
  if (a.hoursLost !== b.hoursLost) out.push(`heures perdues : ${a.hoursLost} ⇒ ${b.hoursLost}`);
  if (JSON.stringify(a.measures) !== JSON.stringify(b.measures)) out.push("relevés météo modifiés");
  const added = b.proofs.filter((p) => !a.proofs.some((x) => x.id === p.id));
  const removed = a.proofs.filter((p) => !b.proofs.some((x) => x.id === p.id));
  if (added.length) out.push(`preuve ajoutée : ${added.map((p) => p.name).join(", ")}`);
  if (removed.length) out.push(`preuve retirée : ${removed.map((p) => p.name).join(", ")}`);
  if (a.photoIds.join() !== b.photoIds.join()) out.push("photos modifiées");
  if (a.comment !== b.comment) out.push("commentaire modifié");
  if (a.status !== b.status) out.push(`statut : ${STATUS_LABEL[a.status]} ⇒ ${STATUS_LABEL[b.status]}`);
  return out.join(" · ");
}

/** Empreinte SHA-256 (hexadécimal) d'un fichier, calculée dans le navigateur. */
export async function sha256(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Données météo historiques (indicatives) ─────────────────────────────────

export type MeasuredWeather = { rainMm: number | null; tMin: number | null; tMax: number | null; windKmh: number | null };

/** Localité d'un chantier : code postal + commune de l'adresse du chantier, sinon du client, sinon du siège. */
export function placeOf(job: Job | undefined, d: Pick<AccountData, "clients" | "company">) {
  const m = job?.siteAddress.match(/\b(\d{4})\s+([\p{L}' -]+)/u);
  if (m) return { postcode: m[1], city: m[2].trim() };
  const client = d.clients.find((c) => c.id === job?.clientId);
  const site = client?.sites.find((s) => s.id === job?.siteId);
  const a = site ?? client?.billing ?? d.company.address;
  return { postcode: a.postcode, city: a.city || d.company.address.city };
}

/** Coordonnées d'une commune belge (Open-Meteo, gratuit, sans clé). */
export async function geocodeBE(city: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!city) return null;
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=fr&countryCode=BE`).then((x) => x.json());
  const p = r?.results?.[0];
  return p ? { lat: p.latitude, lng: p.longitude, label: [p.name, p.admin2 || p.admin1].filter(Boolean).join(", ") } : null;
}

/** Agrège des relevés journaliers : cumul de pluie, minimum, maximum, rafale la plus forte. */
export function aggregateDaily(daily: { precipitation_sum?: (number | null)[]; temperature_2m_min?: (number | null)[]; temperature_2m_max?: (number | null)[]; wind_speed_10m_max?: (number | null)[] }): MeasuredWeather {
  const vals = (a?: (number | null)[]) => (a ?? []).filter((x): x is number => typeof x === "number");
  const rain = vals(daily.precipitation_sum);
  const tmin = vals(daily.temperature_2m_min);
  const tmax = vals(daily.temperature_2m_max);
  const wind = vals(daily.wind_speed_10m_max);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    rainMm: rain.length ? r1(rain.reduce((s, x) => s + x, 0)) : null,
    tMin: tmin.length ? r1(Math.min(...tmin)) : null,
    tMax: tmax.length ? r1(Math.max(...tmax)) : null,
    windKmh: wind.length ? Math.round(Math.max(...wind)) : null,
  };
}

/**
 * Relevés historiques Open-Meteo pour une période passée. Les archives (réanalyse) ont quelques jours de
 * retard : pour les jours récents, on interroge l'API de prévision qui conserve les 92 derniers jours.
 */
export async function fetchHistoricalWeather(lat: number, lng: number, start: string, end: string): Promise<MeasuredWeather | null> {
  const q = `latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=precipitation_sum,temperature_2m_min,temperature_2m_max,wind_speed_10m_max&timezone=Europe%2FBrussels`;
  const tryUrl = async (base: string) => {
    const r = await fetch(`${base}?${q}`);
    if (!r.ok) return null;
    const j = await r.json();
    const m = j?.daily ? aggregateDaily(j.daily) : null;
    return m && (m.rainMm !== null || m.tMax !== null) ? m : null;
  };
  const recent = daysBetween(end, new Date().toISOString().slice(0, 10)) < 85;
  return (recent ? await tryUrl("https://api.open-meteo.com/v1/forecast") : null) ?? (await tryUrl("https://archive-api.open-meteo.com/v1/archive"));
}

// ── Export CSV ───────────────────────────────────────────────────────────────

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const frDate = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const frNum = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** CSV (séparateur « ; », virgule décimale : ouverture directe dans Excel en français). */
export function weatherCsv(list: WeatherDay[], d: Pick<AccountData, "jobs" | "members">) {
  const job = (id: string) => d.jobs.find((j) => j.id === id)?.name ?? "?";
  const member = (id: string) => d.members.find((m) => m.id === id)?.name ?? "?";
  const head = ["Début", "Fin", "Chantier(s)", "Type", "Durée", "Impact", "Ouvriers", "Heures perdues", "Pluie (mm)", "T° min", "T° max", "Vent (km/h)", "Source relevés", "Preuves", "Statut", "Commentaire", "Établi par", "Créé le"];
  const rows = list.map((w) => [
    frDate(w.start),
    frDate(w.end || w.start),
    w.jobIds.map(job).join(" / "),
    KIND_LABEL[w.kind],
    w.duration === "hours" ? `${w.fromTime}–${w.toTime}` : DURATION_LABEL[w.duration],
    IMPACT_LABEL[w.impact],
    w.memberIds.map(member).join(" / "),
    frNum(w.hoursLost),
    frNum(w.measures.rainMm),
    frNum(w.measures.tMin),
    frNum(w.measures.tMax),
    frNum(w.measures.windKmh),
    w.measures.source === "open-meteo" ? "Open-Meteo (indicatif)" : w.measures.source === "manual" ? "Saisie manuelle" : "",
    w.proofs.map((p) => (p.kind === "link" ? p.url : `${p.name} (SHA-256 ${p.sha256.slice(0, 16)}…)`)).join(" | "),
    STATUS_LABEL[displayStatus(w)],
    w.comment,
    w.createdBy,
    frDate(w.createdAt),
  ]);
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
}
