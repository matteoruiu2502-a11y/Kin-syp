import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { GhostTrack, Patient, Session } from '../core';

/**
 * Persistance 100 % locale dans le dossier documents de l'application
 * (exclu du partage, sauvegardé avec l'appareil). Aucune donnée de santé
 * n'est envoyée sur un serveur.
 *
 *   kinesyp/<compte>/patients.json
 *   kinesyp/<compte>/settings.json
 *   kinesyp/<compte>/sessions/<patientId>.json
 *   kinesyp/<compte>/ghosts/<id>.json
 *   kinesyp/<compte>/photos/<id>.jpg
 */
export interface Settings {
  practitionerName: string;
  practitionerTitle: string;
  currentPatientId: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  practitionerName: '',
  practitionerTitle: 'Masseur-kinésithérapeute',
  currentPatientId: null,
};

/** Dossier du compte praticien connecté : chaque kiné a ses propres patients sur la tablette. */
let accountFolder = 'sans-compte';
export function setStorageAccount(accountId: string): void {
  accountFolder = accountId.replace(/[^\w-]/g, '_');
}

function dir(...parts: string[]): Directory {
  const d = new Directory(Paths.document, 'kinesyp', accountFolder, ...parts);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

async function readJson<T>(file: File, fallback: T): Promise<T> {
  if (!file.exists) return fallback;
  try {
    return JSON.parse(await file.text()) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: File, value: unknown): void {
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(value));
}

const patientsFile = () => new File(dir(), 'patients.json');
const settingsFile = () => new File(dir(), 'settings.json');
const sessionsFile = (patientId: string) => new File(dir('sessions'), `${patientId}.json`);

export function loadPatients(): Promise<Patient[]> {
  return readJson(patientsFile(), []);
}

export function savePatients(patients: Patient[]): void {
  writeJson(patientsFile(), patients);
}

export async function loadSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await readJson(settingsFile(), {})) };
}

export function saveSettings(settings: Settings): void {
  writeJson(settingsFile(), settings);
}

export function loadSessions(patientId: string): Promise<Session[]> {
  return readJson(sessionsFile(patientId), []);
}

export function saveSessions(patientId: string, sessions: Session[]): void {
  writeJson(sessionsFile(patientId), sessions);
}

export function saveGhost(id: string, track: GhostTrack): string {
  const file = new File(dir('ghosts'), `${id}.json`);
  writeJson(file, track);
  return file.uri;
}

export function loadGhost(uri: string): Promise<GhostTrack | null> {
  return readJson<GhostTrack | null>(new File(uri), null);
}

/**
 * Importe une photo de la caméra : redimensionnée (1024 px de large, JPEG)
 * pour garder des bilans PDF légers, puis rangée dans le dossier de l'app.
 */
export async function importPhoto(tempPath: string, id: string): Promise<string> {
  const srcUri = tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`;
  const rendered = await ImageManipulator.manipulate(srcUri).resize({ width: 1024 }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const dest = new File(dir('photos'), `${id}.jpg`);
  await new File(saved.uri).move(dest, { overwrite: true });
  const original = new File(srcUri);
  if (original.exists) original.delete();
  return dest.uri;
}

export async function photoDataUri(uri: string): Promise<string | null> {
  const file = new File(uri);
  if (!file.exists) return null;
  return `data:image/jpeg;base64,${await file.base64()}`;
}
