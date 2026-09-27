import { fold } from './dictation';
import { formatDateFr } from './report/escape';
import type { Patient } from './model';

/**
 * Recherche de patients tolérante : sans accents ni casse, mots dans
 * n'importe quel ordre ("lea martin" trouve "MARTIN Léa"), et date de
 * naissance ("12/03" ou "1988").
 */
export function patientMatches(patient: Patient, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = fold(`${patient.lastName} ${patient.firstName} ${formatDateFr(patient.birthDate)} ${patient.birthDate}`);
  return tokens.every((t) => haystack.includes(t));
}

/** Filtre puis trie : nom qui commence par la recherche d'abord, puis ordre alphabétique. */
export function searchPatients(patients: Patient[], query: string): Patient[] {
  const q = fold(query).trim();
  const byName = (a: Patient, b: Patient) =>
    fold(`${a.lastName} ${a.firstName}`).localeCompare(fold(`${b.lastName} ${b.firstName}`));
  const results = patients.filter((p) => patientMatches(p, query));
  if (!q) return results.sort(byName);
  const starts = (p: Patient) => fold(p.lastName).startsWith(q) || fold(p.firstName).startsWith(q);
  return results.sort((a, b) => Number(starts(b)) - Number(starts(a)) || byName(a, b));
}
