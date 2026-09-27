import type { StructuredNote } from './dictation';
import type { JointMeasurement } from './jointAnalyzer';
import type { JointId } from './joints';
import type { Sex } from './norms';
import type { PostureMetric, PostureView } from './posture';
import type { SportSummary } from './sport';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  /** AAAA-MM-JJ */
  birthDate: string;
  sex: Sex;
  createdAt: string;
}

export type MeasureMode = 'standard' | 'sport' | 'pediatric' | 'posture';

export const MEASURE_MODE_LABELS: Record<MeasureMode, string> = {
  standard: 'Standard',
  sport: 'Sport',
  pediatric: 'Pédiatrie',
  posture: 'Posturo',
};

export interface JointRecord {
  jointId: JointId;
  peak: number;
  min: number;
  measuredAt: string;
}

export interface PostureRecord {
  view: PostureView;
  metrics: PostureMetric[];
  capturedAt: string;
}

export interface PhotoRecord {
  /** Chemin local (dossier documents de l'app). */
  uri: string;
  caption: string;
  takenAt: string;
}

/** Une séance = un patient, un jour. Les enregistrements successifs s'y cumulent. */
export interface Session {
  id: string;
  patientId: string;
  /** AAAA-MM-JJ (date locale) */
  date: string;
  updatedAt: string;
  joints: Partial<Record<JointId, JointRecord>>;
  sport: SportSummary[];
  posture: PostureRecord[];
  notes: StructuredNote[];
  photos: PhotoRecord[];
  /** Fichier du squelette enregistré pour le mode fantôme. */
  ghostFile: string | null;
}

/** Amplitude parcourue minimale (°) pour considérer qu'une articulation a été mesurée. */
export const MIN_MEASURED_RANGE = 10;

export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function newId(prefix: string, now: Date = new Date()): string {
  return `${prefix}-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(patientId: string, now: Date = new Date()): Session {
  return {
    id: newId('s', now),
    patientId,
    date: localDate(now),
    updatedAt: now.toISOString(),
    joints: {},
    sport: [],
    posture: [],
    notes: [],
    photos: [],
    ghostFile: null,
  };
}

/** Articulations réellement mobilisées pendant la série (évite d'enregistrer le bruit). */
export function measuredJoints(measurements: JointMeasurement[]): JointMeasurement[] {
  return measurements.filter(
    (m) => m.peak !== null && m.min !== null && m.peak - m.min >= MIN_MEASURED_RANGE,
  );
}

/**
 * Ajoute les mesures d'une série à la séance. Si l'articulation est déjà
 * mesurée, on garde la meilleure amplitude (max du pic, min de l'extension).
 */
export function recordJoints(session: Session, measurements: JointMeasurement[], now: Date = new Date()): Session {
  const joints = { ...session.joints };
  for (const m of measuredJoints(measurements)) {
    const prev = joints[m.id];
    joints[m.id] = {
      jointId: m.id,
      peak: Math.round(prev ? Math.max(prev.peak, m.peak!) : m.peak!),
      min: Math.round(prev ? Math.min(prev.min, m.min!) : m.min!),
      measuredAt: now.toISOString(),
    };
  }
  return { ...session, joints, updatedAt: now.toISOString() };
}

export function addNote(session: Session, note: StructuredNote): Session {
  return { ...session, notes: [...session.notes, note], updatedAt: note.createdAt };
}

export function removeNote(session: Session, noteId: string): Session {
  return { ...session, notes: session.notes.filter((n) => n.id !== noteId) };
}

export function addPhoto(session: Session, photo: PhotoRecord): Session {
  return { ...session, photos: [...session.photos, photo], updatedAt: photo.takenAt };
}

export function addPosture(session: Session, record: PostureRecord): Session {
  // Une seule analyse par vue : la plus récente remplace la précédente.
  const posture = [...session.posture.filter((p) => p.view !== record.view), record];
  return { ...session, posture, updatedAt: record.capturedAt };
}

export function setSport(session: Session, summaries: SportSummary[], now: Date = new Date()): Session {
  const byJoint = new Map(session.sport.map((s) => [s.jointId, s]));
  for (const s of summaries) byJoint.set(s.jointId, s);
  return { ...session, sport: [...byJoint.values()], updatedAt: now.toISOString() };
}

export interface HistoryPoint {
  date: string;
  value: number;
}

/** Évolution du pic d'une articulation au fil des séances (ordre chronologique). */
export function jointHistory(sessions: Session[], id: JointId): HistoryPoint[] {
  return sessions
    .filter((s) => s.joints[id] !== undefined)
    .map((s) => ({ date: s.date, value: s.joints[id]!.peak }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Dernière séance antérieure disposant d'un fantôme (mode avant/après). */
export function previousGhostSession(sessions: Session[], current: Session): Session | null {
  return (
    sessions
      .filter((s) => s.id !== current.id && s.ghostFile && s.date <= current.date)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  );
}

/** "12/03/1988" → "1988-03-12" ; null si la date est invalide ou future. */
export function parseFrenchDate(text: string, today: Date = new Date()): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date > today || y < 1900) return null;
  return localDate(date);
}
