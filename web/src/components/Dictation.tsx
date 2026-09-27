import { useEffect, useRef, useState } from 'react';

import { type StructuredNote } from '@core';

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function createRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const EXAMPLES = [
  'Flexion genou droit 118 degrés, légère douleur en fin de course',
  'Douleur genou droit EVA 3 sur 10 à l’effort. Bonne progression, marche sans boiterie',
  'Flexion épaule droite cent cinquante degrés, abduction quatre-vingt-dix',
];

/**
 * Dictée : reconnaissance vocale du navigateur quand elle est disponible,
 * sinon saisie au clavier. Le texte est structuré par le même analyseur
 * que l'application tablette.
 */
export function DictationPanel({ onNote, notes, onDelete }: { onNote: (text: string) => void; notes: StructuredNote[]; onDelete: (id: string) => void }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const supported = typeof window !== 'undefined' && !!createRecognition;

  useEffect(() => () => recRef.current?.stop(), []);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = createRecognition();
    if (!rec) {
      setMicError('La dictée vocale n’est pas proposée par ce navigateur (essayez Chrome ou Safari). Saisissez le texte ci-dessous.');
      return;
    }
    finalRef.current = text ? `${text.trim()} ` : '';
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      setText(`${finalRef.current}${interim}`);
    };
    rec.onerror = (e) => {
      setMicError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Micro refusé ou indisponible dans cette page. Saisissez le texte ci-dessous, ou lancez la version locale (npm run dev).'
          : `Dictée interrompue (${e.error}).`,
      );
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setMicError(null);
      setListening(true);
    } catch {
      setMicError('Impossible de démarrer la dictée dans cette page.');
    }
  };

  const submit = () => {
    if (!text.trim()) return;
    recRef.current?.stop();
    onNote(text.trim());
    setText('');
    finalRef.current = '';
  };

  return (
    <section className="panel">
      <div className="panel-title-row">
        <h3>Observations</h3>
        <button type="button" className={`mic ${listening ? 'mic-on' : ''}`} onClick={toggleMic} aria-pressed={listening} disabled={!supported}>
          {listening ? '■ Arrêter' : '🎙 Dicter'}
        </button>
      </div>
      {micError && <p className="notice">{micError}</p>}
      <label className="sr-only" htmlFor="note-input">
        Observation
      </label>
      <textarea
        id="note-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex. : Flexion genou droit 90°, légère douleur en fin de course"
        rows={3}
      />
      <div className="row-wrap">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={!text.trim()}>
          Ajouter au bilan
        </button>
        <span className="muted small">Essayer :</span>
        {EXAMPLES.map((ex, i) => (
          <button key={i} type="button" className="chip" onClick={() => setText(ex)}>
            Exemple {i + 1}
          </button>
        ))}
      </div>
      <ul className="notes">
        {[...notes].reverse().map((n) => (
          <li key={n.id} className="note">
            <div>
              {n.measures.map((m, i) => (
                <div key={`m${i}`} className="note-line">
                  <span className="tag">Mesure</span> {m.movement} {m.region.toLowerCase()} {m.side === 'left' ? 'gauche' : m.side === 'right' ? 'droit' : ''} : <b>{m.value}°</b>
                </div>
              ))}
              {n.pain.map((p, i) => (
                <div key={`p${i}`} className="note-line">
                  <span className="tag tag-pain">Douleur</span> {p.level}
                  {p.eva !== null ? ` · EVA ${p.eva}/10` : ''}
                  {p.context ? ` · ${p.context}` : ''}
                </div>
              ))}
              {n.observations.map((o, i) => (
                <div key={`o${i}`} className="note-line">
                  <span className="tag tag-obs">Note</span> {o}
                </div>
              ))}
              <div className="note-raw">« {n.raw} »</div>
            </div>
            <button type="button" className="icon-btn" aria-label="Supprimer la note" onClick={() => onDelete(n.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
