import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  GhostRecorder,
  addNote,
  createSession,
  localDate,
  newId,
  parseDictation,
  type GhostTrack,
  type JointId,
  type Patient,
  type Session,
} from '@core';
import { DEMO_IMAGE, demoFrame } from './demo/demoPatient';
import { mapToView } from './pose/mapping';

/**
 * Stockage dans le navigateur (localStorage), propre à cet appareil.
 * Si le navigateur le refuse (navigation privée, page intégrée), les
 * données restent en mémoire le temps de la visite.
 */
export interface Settings {
  practitionerName: string;
  practitionerTitle: string;
  currentPatientId: string | null;
}

interface Data {
  patients: Patient[];
  sessions: Session[];
  settings: Settings;
}

const KEY = 'kinesyp:v1';
const GHOST_PREFIX = 'kinesyp:ghost:';
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* stockage indisponible */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function saveGhost(track: GhostTrack): string {
  const id = `${GHOST_PREFIX}${newId('g')}`;
  write(id, JSON.stringify(track));
  return id;
}

export function loadGhost(id: string): GhostTrack | null {
  const raw = read(id);
  return raw ? (JSON.parse(raw) as GhostTrack) : null;
}

// --- Données d'exemple ----------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function seedGhost(scale: number): string {
  const recorder = new GhostRecorder(15, 40_000);
  const view = { width: 1000, height: 563 };
  for (let t = 0; t < 38; t += 1 / 15) {
    const f = demoFrame('rehab', t, scale);
    recorder.push(mapToView(f.landmarks, DEMO_IMAGE, view, false), t * 1000);
  }
  return saveGhost(recorder.toTrack()!);
}

function seedData(): Data {
  const patient: Patient = {
    id: 'p-exemple',
    firstName: 'Camille (exemple)',
    lastName: 'Dubois',
    birthDate: '1991-05-14',
    sex: 'F',
    createdAt: daysAgo(21).toISOString(),
  };
  const history: Array<[number, Partial<Record<JointId, [number, number]>>, string, number | null]> = [
    [21, { knee_right: [84, 14], knee_left: [134, 1], elbow_right: [118, 12], shoulder_right: [112, 6] }, 'Flexion genou droit 85 degrés, douleur modérée EVA 5 en fin de course. Œdème péri-rotulien', 0.6],
    [10, { knee_right: [103, 8], knee_left: [135, 0], elbow_right: [128, 9], shoulder_right: [138, 5] }, 'Flexion genou droit 105°, légère douleur en fin de course. Bonne tolérance au renforcement', 0.78],
  ];
  const sessions = history.map(([ago, joints, note, ghostScale]) => {
    const date = daysAgo(ago);
    let s: Session = createSession(patient.id, date);
    s = {
      ...s,
      joints: Object.fromEntries(
        Object.entries(joints).map(([id, [peak, min]]) => [id, { jointId: id as JointId, peak, min, measuredAt: date.toISOString() }]),
      ),
      ghostFile: ghostScale ? seedGhost(ghostScale) : null,
    };
    return addNote(s, parseDictation(note, date));
  });
  return {
    patients: [patient],
    sessions,
    settings: { practitionerName: 'Cabinet de démonstration', practitionerTitle: 'Masseur-kinésithérapeute', currentPatientId: patient.id },
  };
}

function load(): Data {
  const raw = read(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Data;
    } catch {
      /* données corrompues : on repart des exemples */
    }
  }
  const seeded = seedData();
  write(KEY, JSON.stringify(seeded));
  return seeded;
}

// --- Contexte React ---------------------------------------------------------------

interface StoreValue extends Data {
  currentPatient: Patient | null;
  patientSessions: Session[];
  todaySession: Session | null;
  persisted: boolean;
  addPatient: (p: Omit<Patient, 'id' | 'createdAt'>) => void;
  selectPatient: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  updateTodaySession: (fn: (s: Session) => Session) => Session | null;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load);
  const [persisted, setPersisted] = useState(true);
  const dataRef = useRef(data);

  const commit = useCallback((next: Data) => {
    dataRef.current = next;
    setData(next);
    setPersisted(write(KEY, JSON.stringify(next)));
  }, []);

  const currentPatient = data.patients.find((p) => p.id === data.settings.currentPatientId) ?? null;
  const patientSessions = useMemo(
    () => data.sessions.filter((s) => s.patientId === currentPatient?.id).sort((a, b) => a.date.localeCompare(b.date)),
    [data.sessions, currentPatient?.id],
  );
  const today = localDate(new Date());
  const todaySession = patientSessions.find((s) => s.date === today) ?? null;

  const value: StoreValue = {
    ...data,
    currentPatient,
    patientSessions,
    todaySession,
    persisted,
    addPatient: (p) => {
      const patient: Patient = { ...p, id: newId('p'), createdAt: new Date().toISOString() };
      const d = dataRef.current;
      commit({ ...d, patients: [...d.patients, patient], settings: { ...d.settings, currentPatientId: patient.id } });
    },
    selectPatient: (id) => {
      const d = dataRef.current;
      commit({ ...d, settings: { ...d.settings, currentPatientId: id } });
    },
    updateSettings: (patch) => {
      const d = dataRef.current;
      commit({ ...d, settings: { ...d.settings, ...patch } });
    },
    updateTodaySession: (fn) => {
      const d = dataRef.current;
      const patient = d.patients.find((p) => p.id === d.settings.currentPatientId);
      if (!patient) return null;
      const now = new Date();
      const day = localDate(now);
      const existing = d.sessions.find((s) => s.patientId === patient.id && s.date === day) ?? createSession(patient.id, now);
      const updated = fn(existing);
      commit({ ...d, sessions: [...d.sessions.filter((s) => s.id !== existing.id), updated] });
      return updated;
    },
    resetDemo: () => {
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('kinesyp:')) localStorage.removeItem(k);
      } catch {
        /* rien à nettoyer */
      }
      memory.clear();
      commit(seedData());
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore hors de <StoreProvider>');
  return ctx;
}
