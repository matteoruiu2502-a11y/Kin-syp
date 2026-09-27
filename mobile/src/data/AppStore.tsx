import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createSession, localDate, newId, type Patient, type Session } from '../core';
import * as storage from './storage';

interface AppStoreValue {
  ready: boolean;
  patients: Patient[];
  settings: storage.Settings;
  currentPatient: Patient | null;
  /** Séances du patient courant (chronologiques). */
  sessions: Session[];
  /** Séance du jour du patient courant (créée à la première écriture). */
  todaySession: Session | null;
  addPatient: (p: Omit<Patient, 'id' | 'createdAt'>) => Patient;
  selectPatient: (id: string | null) => void;
  updateSettings: (patch: Partial<storage.Settings>) => void;
  /** Modifie (ou crée) la séance du jour ; renvoie la séance mise à jour. */
  updateTodaySession: (fn: (s: Session) => Session) => Session | null;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState<storage.Settings>(storage.DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<Session[]>([]);
  // Référence synchrone : plusieurs mises à jour peuvent s'enchaîner avant le rendu.
  const sessionsRef = useRef<Session[]>([]);
  // Patient dont les séances sont chargées : évite d'écraser le fichier avant lecture.
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([storage.loadPatients(), storage.loadSettings()]);
      setPatients(p);
      setSettings(s);
      setReady(true);
    })().catch(() => setReady(true));
  }, []);

  const currentPatient = useMemo(
    () => patients.find((p) => p.id === settings.currentPatientId) ?? null,
    [patients, settings.currentPatientId],
  );

  useEffect(() => {
    loadedForRef.current = null;
    if (!currentPatient) {
      sessionsRef.current = [];
      setSessions([]);
      return;
    }
    let cancelled = false;
    storage.loadSessions(currentPatient.id).then((s) => {
      if (cancelled) return;
      const sorted = [...s].sort((a, b) => a.date.localeCompare(b.date));
      sessionsRef.current = sorted;
      loadedForRef.current = currentPatient.id;
      setSessions(sorted);
    });
    return () => {
      cancelled = true;
    };
  }, [currentPatient]);

  const updateSettings = useCallback((patch: Partial<storage.Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storage.saveSettings(next);
      return next;
    });
  }, []);

  const addPatient = useCallback(
    (p: Omit<Patient, 'id' | 'createdAt'>) => {
      const patient: Patient = { ...p, id: newId('p'), createdAt: new Date().toISOString() };
      setPatients((prev) => {
        const next = [...prev, patient].sort((a, b) => a.lastName.localeCompare(b.lastName));
        storage.savePatients(next);
        return next;
      });
      updateSettings({ currentPatientId: patient.id });
      return patient;
    },
    [updateSettings],
  );

  const selectPatient = useCallback((id: string | null) => updateSettings({ currentPatientId: id }), [updateSettings]);

  const today = localDate(new Date());
  const todaySession = sessions.find((s) => s.date === today) ?? null;

  const updateTodaySession = useCallback(
    (fn: (s: Session) => Session) => {
      if (!currentPatient || loadedForRef.current !== currentPatient.id) return null;
      const now = new Date();
      const day = localDate(now);
      const list = sessionsRef.current;
      const existing = list.find((s) => s.date === day) ?? createSession(currentPatient.id, now);
      const updated = fn(existing);
      const next = [...list.filter((s) => s.id !== existing.id), updated].sort((a, b) => a.date.localeCompare(b.date));
      sessionsRef.current = next;
      setSessions(next);
      storage.saveSessions(currentPatient.id, next);
      return updated;
    },
    [currentPatient],
  );

  const value = useMemo(
    () => ({
      ready,
      patients,
      settings,
      currentPatient,
      sessions,
      todaySession,
      addPatient,
      selectPatient,
      updateSettings,
      updateTodaySession,
    }),
    [ready, patients, settings, currentPatient, sessions, todaySession, addPatient, selectPatient, updateSettings, updateTodaySession],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore doit être utilisé dans <AppStoreProvider>');
  return ctx;
}
