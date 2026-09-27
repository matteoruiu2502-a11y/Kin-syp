import * as Haptics from 'expo-haptics';
import { useCallback, useState, type RefObject } from 'react';
import type { Camera } from 'react-native-vision-camera';

import {
  JOINTS_BY_ID,
  addNote,
  addPhoto,
  addPosture,
  measuredJoints,
  newId,
  parseDictation,
  recordJoints,
  setSport,
  type MeasureMode,
  type PhotoRecord,
} from '../../core';
import { useAppStore } from '../../data/AppStore';
import { importPhoto, saveGhost } from '../../data/storage';
import type { MeasureSnapshot } from '../measure/usePoseAnalysis';
import { exportReportPdf } from '../report/exportPdf';

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export function useSessionActions() {
  const store = useAppStore();
  const [busy, setBusy] = useState<'save' | 'pdf' | null>(null);

  /** Enregistre la série en cours dans la séance du jour (1 clic). */
  const saveMeasure = useCallback(
    async (snapshot: MeasureSnapshot, mode: MeasureMode, camera: RefObject<Camera | null>): Promise<ActionResult> => {
      if (!store.currentPatient) return { ok: false, message: 'Choisissez d’abord un patient' };
      setBusy('save');
      try {
        const now = new Date();
        const measured = measuredJoints(Object.values(snapshot.analysis.joints));
        const posture = mode === 'posture' ? snapshot.posture : null;

        let photo: PhotoRecord | null = null;
        try {
          const file = await camera.current?.takePhoto({ flash: 'off', enableShutterSound: false });
          if (file) {
            const caption = posture
              ? `Posture — vue ${posture.view === 'front' ? 'de face' : 'de profil'}`
              : measured.map((m) => `${JOINTS_BY_ID[m.id].label} ${Math.round(m.peak!)}°`).join(' · ') || 'Capture';
            photo = {
              uri: await importPhoto(file.path, newId('ph', now)),
              caption,
              takenAt: now.toISOString(),
            };
          }
        } catch {
          // La photo est un plus : l'enregistrement des mesures ne doit pas échouer pour elle.
        }

        const ghostUri = snapshot.ghost && measured.length > 0 ? saveGhost(newId('g', now), snapshot.ghost) : null;

        const updated = store.updateTodaySession((s) => {
          let next = recordJoints(s, measured, now);
          if (mode === 'sport' && snapshot.sport.length > 0) next = setSport(next, snapshot.sport, now);
          if (posture) next = addPosture(next, { view: posture.view, metrics: posture.metrics, capturedAt: now.toISOString() });
          if (photo) next = addPhoto(next, photo);
          if (ghostUri) next = { ...next, ghostFile: ghostUri };
          return next;
        });
        if (!updated) return { ok: false, message: 'Séance indisponible, réessayez' };

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const parts = [
          measured.length > 0 ? `${measured.length} amplitude${measured.length > 1 ? 's' : ''}` : null,
          posture ? 'posture' : null,
          photo ? 'photo' : null,
        ].filter(Boolean);
        return { ok: true, message: parts.length ? `✓ Enregistré : ${parts.join(', ')}` : '✓ Enregistré' };
      } finally {
        setBusy(null);
      }
    },
    [store],
  );

  /** Structure une dictée et l'ajoute aux observations de la séance du jour. */
  const addDictation = useCallback(
    (text: string): ActionResult => {
      if (!store.currentPatient) return { ok: false, message: 'Choisissez d’abord un patient' };
      const note = parseDictation(text);
      const updated = store.updateTodaySession((s) => addNote(s, note));
      if (!updated) return { ok: false, message: 'Séance indisponible, réessayez' };
      const n = note.measures.length;
      return { ok: true, message: `✓ Note ajoutée${n ? ` (${n} mesure${n > 1 ? 's' : ''} reconnue${n > 1 ? 's' : ''})` : ''}` };
    },
    [store],
  );

  const exportPdf = useCallback(async (): Promise<ActionResult> => {
    const { currentPatient, sessions, todaySession, settings } = store;
    const session = todaySession ?? sessions[sessions.length - 1];
    if (!currentPatient || !session) return { ok: false, message: 'Aucune séance à exporter' };
    setBusy('pdf');
    try {
      await exportReportPdf({ patient: currentPatient, session, sessions, settings });
      return { ok: true, message: '✓ Bilan PDF généré' };
    } catch (e) {
      return { ok: false, message: `Échec de l’export : ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      setBusy(null);
    }
  }, [store]);

  return { busy, saveMeasure, addDictation, exportPdf };
}
