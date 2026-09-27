import { useMemo, useRef } from 'react';

import { addNote, buildReportHtml, formatDateFr, parseDictation, removeNote } from '@core';
import { DictationPanel } from '../components/Dictation';
import { useStore } from '../store';

/** Vrai quand l'application s'exécute dans une page intégrée (impression bloquée). */
const EMBEDDED = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

export function ReportView({ onToast, goPatients }: { onToast: (t: string, tone?: 'ok' | 'error') => void; goPatients: () => void }) {
  const store = useStore();
  const { currentPatient: patient, patientSessions, todaySession, settings } = store;
  const session = todaySession ?? patientSessions[patientSessions.length - 1] ?? null;
  const frameRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => {
    if (!patient || !session) return null;
    return buildReportHtml({
      patient,
      session,
      history: patientSessions,
      practitioner: { name: settings.practitionerName || 'Praticien', title: settings.practitionerTitle },
      photos: session.photos.slice(-6).map((p) => ({ dataUri: p.uri, caption: p.caption })),
      generatedAt: new Date(),
    });
  }, [patient, session, patientSessions, settings]);

  if (!patient) {
    return (
      <div className="empty">
        <p>Aucun patient sélectionné.</p>
        <button type="button" className="btn btn-primary" onClick={goPatients}>
          Choisir un patient
        </button>
      </div>
    );
  }

  const addText = (text: string) => {
    const note = parseDictation(text);
    store.updateTodaySession((s) => addNote(s, note));
    onToast(`Note ajoutée${note.measures.length ? ` · ${note.measures.length} mesure(s) reconnue(s)` : ''}`);
  };

  return (
    <div className="report">
      <div className="report-side">
        <div className="panel">
          <h3>
            {patient.lastName.toUpperCase()} {patient.firstName}
          </h3>
          <p className="muted">
            {session ? `Séance du ${formatDateFr(session.date)}` : 'Aucune séance'} · {patientSessions.length} séance{patientSessions.length > 1 ? 's' : ''} au total
          </p>
          {session && !todaySession && (
            <p className="notice">Pas encore de mesure aujourd’hui : le bilan montre la dernière séance. Enregistrez une mesure pour créer la séance du jour.</p>
          )}
          {EMBEDDED ? (
            <p className="notice">
              Dans cette page intégrée, l’impression est bloquée : l’aperçu ci-contre est exactement le PDF produit par l’application (bouton « Exporter le PDF » sur tablette, ou « Imprimer / PDF » en version locale).
            </p>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => frameRef.current?.contentWindow?.print()} disabled={!html}>
              Imprimer / enregistrer en PDF
            </button>
          )}
        </div>
        <DictationPanel
          onNote={addText}
          notes={todaySession?.notes ?? []}
          onDelete={(id) => store.updateTodaySession((s) => removeNote(s, id))}
        />
      </div>
      <div className="report-preview">
        {html ? (
          <iframe ref={frameRef} title="Aperçu du bilan PDF" srcDoc={html} />
        ) : (
          <div className="empty">
            <p>Aucune séance pour ce patient. Mesurez puis cliquez « Enregistrer ».</p>
          </div>
        )}
      </div>
    </div>
  );
}
