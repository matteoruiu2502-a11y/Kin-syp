import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  JOINTS_BY_ID,
  MEASURE_MODE_LABELS,
  addPhoto,
  addPosture,
  ageAt,
  localDate,
  measuredJoints,
  normFor,
  recordJoints,
  setSport,
  type GhostTrack,
  type MeasureMode,
} from '@core';
import { captureStage } from '../capture';
import { GhostLayer, PediatricLayer, PostureLayer, SkeletonLayer, pediatricTarget } from '../components/Overlays';
import { HeroReadout, JointGrid, PosturePanel, SportPanel } from '../components/Panels';
import { DEMO_IMAGE, DEMO_SCENARIO_LABELS, type DemoScenario } from '../demo/demoPatient';
import { useLiveAnalysis, type SourceKind } from '../pose/useLiveAnalysis';
import { loadGhost, saveGhost, useStore } from '../store';

const MODES: MeasureMode[] = ['standard', 'sport', 'pediatric', 'posture'];
const REWARDS = ['⭐', '🌟', '🏆', '🦄', '🚀', '🎈'];

export function MeasureView({ onToast, goReport }: { onToast: (t: string, tone?: 'ok' | 'error') => void; goReport: () => void }) {
  const store = useStore();
  const [mode, setMode] = useState<MeasureMode>('standard');
  const [source, setSource] = useState<SourceKind>('demo');
  const [scenario, setScenario] = useState<DemoScenario>('rehab');
  const [paused, setPaused] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ghostOn, setGhostOn] = useState(false);
  const [view, setView] = useState({ width: 0, height: 0 });

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { live, status, restart, setFocus, snapshot } = useLiveAnalysis({ mode, source, scenario, paused, videoRef, canvasRef, stageRef });
  const { analysis, landmarks, compensations } = live;

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Posturologie : le patient simulé se met en station debout.
  const changeMode = (m: MeasureMode) => {
    setMode(m);
    if (source === 'demo') setScenario(m === 'posture' ? 'posture_front' : 'rehab');
    restart();
  };

  // --- Caméra (fonctionne en local ; bloquée dans une page intégrée).
  useEffect(() => {
    if (source !== 'camera') return;
    let stream: MediaStream | null = null;
    setCameraError(null);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: 'user' }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraError('Caméra indisponible : accès refusé ou page intégrée. Lancez la version locale (npm run dev), importez une vidéo ou utilisez la démo.');
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [source]);

  useEffect(() => {
    if (source !== 'video' || !videoUrl || !videoRef.current) return;
    const v = videoRef.current;
    v.srcObject = null;
    v.src = videoUrl;
    v.loop = true;
    v.play().catch(() => {});
  }, [source, videoUrl]);

  // --- Normes du patient.
  const today = localDate(new Date());
  const patient = store.currentPatient;
  const age = patient ? ageAt(patient.birthDate, today) : mode === 'pediatric' ? 6 : 30;
  const sex = patient?.sex ?? 'M';
  const activeDef = analysis.activeJointId ? JOINTS_BY_ID[analysis.activeJointId] : null;
  const norm = activeDef ? normFor(activeDef.kind, age, sex) : null;

  // --- Fantôme : dernière séance antérieure avec squelette enregistré.
  const ghostSession = useMemo(() => [...store.patientSessions].reverse().find((s) => s.date < today && s.ghostFile) ?? null, [store.patientSessions, today]);
  const ghost: GhostTrack | null = useMemo(() => (ghostSession?.ghostFile ? loadGhost(ghostSession.ghostFile) : null), [ghostSession]);

  // --- Pédiatrie.
  const kid = pediatricTarget(analysis, landmarks, norm ? Math.round(norm.max * 0.9) : null);
  const [stars, setStars] = useState(0);
  const [party, setParty] = useState(false);
  const armed = useRef(true);
  useEffect(() => {
    if (mode !== 'pediatric') return;
    if (kid.progress >= 1 && armed.current) {
      armed.current = false;
      setStars((s) => s + 1);
      setParty(true);
      const t = setTimeout(() => setParty(false), 1200);
      return () => clearTimeout(t);
    }
    if (kid.progress < 0.3) armed.current = true;
  }, [kid.progress, mode]);

  const active = analysis.activeJointId ? analysis.joints[analysis.activeJointId] : null;

  const save = () => {
    if (!patient) return onToast('Choisissez d’abord un patient (onglet Patients)', 'error');
    const snap = snapshot();
    const measured = measuredJoints(Object.values(snap.analysis.joints));
    const posture = mode === 'posture' ? snap.posture : null;
    const now = new Date();
    const media = source === 'demo' ? canvasRef.current : videoRef.current;
    const photoUri = captureStage(media, view, landmarks, snap.analysis, source === 'camera');
    const caption = posture
      ? `Posture — vue ${posture.view === 'front' ? 'de face' : 'de profil'}`
      : measured.map((m) => `${JOINTS_BY_ID[m.id].label} ${Math.round(m.peak!)}°`).join(' · ') || 'Capture';
    const ghostId = snap.ghost && measured.length > 0 ? saveGhost(snap.ghost) : null;
    store.updateTodaySession((s) => {
      let next = recordJoints(s, measured, now);
      if (mode === 'sport' && snap.sport.length) next = setSport(next, snap.sport, now);
      if (posture) next = addPosture(next, { view: posture.view, metrics: posture.metrics, capturedAt: now.toISOString() });
      if (photoUri) next = addPhoto(next, { uri: photoUri, caption, takenAt: now.toISOString() });
      if (ghostId) next = { ...next, ghostFile: ghostId };
      return next;
    });
    const parts = [measured.length ? `${measured.length} amplitude${measured.length > 1 ? 's' : ''}` : null, posture ? 'posture' : null, photoUri ? 'capture' : null].filter(Boolean);
    onToast(parts.length ? `Enregistré : ${parts.join(', ')}` : 'Rien à enregistrer : faites d’abord un mouvement');
    restart();
  };

  return (
    <div className="measure">
      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-selected' : ''} onClick={() => changeMode(m)}>
              {MEASURE_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="segmented" role="tablist" aria-label="Source">
          {(['demo', 'video', 'camera'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={source === s} className={source === s ? 'is-selected' : ''} onClick={() => setSource(s)}>
              {s === 'demo' ? 'Patient démo' : s === 'video' ? 'Vidéo' : 'Caméra'}
            </button>
          ))}
        </div>
        {source === 'demo' && (
          <>
            <label className="sr-only" htmlFor="scenario">
              Scénario
            </label>
            <select id="scenario" value={scenario} onChange={(e) => setScenario(e.target.value as DemoScenario)}>
              {Object.entries(DEMO_SCENARIO_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => setPaused((p) => !p)}>
              {paused ? '▶ Lecture' : '❚❚ Pause'}
            </button>
          </>
        )}
        {source === 'video' && (
          <label className="btn file-btn">
            Choisir une vidéo…
            <input
              id="video-file"
              type="file"
              accept="video/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setVideoUrl(URL.createObjectURL(f));
              }}
            />
          </label>
        )}
      </div>

      <div className="measure-body">
        <div className="stage-col">
          <div className="stage" ref={stageRef}>
            {source === 'demo' ? (
              <canvas ref={canvasRef} width={DEMO_IMAGE.width} height={DEMO_IMAGE.height} className="media" />
            ) : (
              <video ref={videoRef} className={`media${source === 'camera' ? ' mirrored' : ''}`} playsInline muted />
            )}
            <svg className="overlay" width={view.width} height={view.height} viewBox={`0 0 ${view.width || 1} ${view.height || 1}`}>
              {ghostOn && ghost && <GhostLayer track={ghost} live={landmarks} view={view} />}
              <SkeletonLayer landmarks={landmarks} analysis={analysis} compensations={compensations} showAngles={mode === 'standard' || mode === 'sport'} />
              {mode === 'posture' && <PostureLayer posture={live.posture} landmarks={landmarks} />}
              {mode === 'pediatric' && <PediatricLayer target={kid.target} tip={kid.tip} reached={kid.progress >= 1} />}
            </svg>

            <div className="stage-hud">
              <div className="hud-top">
                {mode !== 'posture' && mode !== 'pediatric' && landmarks ? <HeroReadout analysis={analysis} norm={patient ? norm : null} /> : <span />}
                <span className="chip-status">
                  {status.fps} i/s · analyse locale
                </span>
              </div>
              <div className="hud-alerts">
                {status.error && <div className="alert alert-danger">{status.error}</div>}
                {cameraError && source === 'camera' && <div className="alert alert-danger">{cameraError}</div>}
                {status.message && <div className="alert">{status.message}</div>}
                {compensations.map((c) => (
                  <div key={c.kind} className="alert alert-danger">
                    ⚠ {c.message} ({Math.round(c.deviationDeg)}°)
                  </div>
                ))}
                {active?.tracked && active.outOfPlane && activeDef && mode !== 'posture' && (
                  <div className="alert alert-warn">{activeDef.label} hors du plan de la caméra : placez-la face au mouvement</div>
                )}
                {!landmarks && !status.message && !status.error && !(source === 'video' && !videoUrl) && (
                  <div className="alert">Placez le patient en entier dans le cadre</div>
                )}
                {source === 'video' && !videoUrl && <div className="alert">Importez une vidéo d’un patient (de profil de préférence)</div>}
                {landmarks && !live.calibrated && mode !== 'posture' && <div className="alert">Calibrage de la posture… restez immobile</div>}
              </div>
              {status.caption && <div className="hud-caption">{status.caption}</div>}
            </div>

            {mode === 'pediatric' && (
              <>
                <div className="rocket-track" aria-hidden="true">
                  <div className="rocket-fill" style={{ height: `${Math.round(kid.progress * 100)}%` }} />
                  <span className="rocket" style={{ bottom: `${Math.round(kid.progress * 82)}%` }}>
                    🚀
                  </span>
                </div>
                <div className="kid-score">{stars ? REWARDS.slice(0, Math.min(stars, 6)).join(' ') + (stars > 6 ? ` ×${stars}` : '') : 'Attrape l’étoile !'}</div>
                {party && <div className="kid-party">Bravo !</div>}
              </>
            )}
          </div>

          {mode !== 'posture' && mode !== 'pediatric' && landmarks && (
            <div className="hero-below">
              <HeroReadout analysis={analysis} norm={patient ? norm : null} />
            </div>
          )}
          <div className="actions">
            <button type="button" className="btn" onClick={restart} title="Remet à zéro les amplitudes et recalibre la posture">
              ↺ Nouvelle série
            </button>
            {ghost && (
              <button type="button" className={`btn ${ghostOn ? 'btn-ghost-on' : ''}`} aria-pressed={ghostOn} onClick={() => setGhostOn((v) => !v)}>
                Fantôme du {ghostSession?.date.split('-').reverse().join('/')}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn btn-primary btn-lg" onClick={save}>
              Enregistrer
            </button>
            <button type="button" className="btn btn-lg" onClick={goReport}>
              Bilan →
            </button>
          </div>
        </div>

        <aside className="side">
          {mode === 'sport' && <SportPanel analysis={analysis} repCount={live.repCount} lastRep={live.lastRep} />}
          {mode === 'posture' && <PosturePanel posture={live.posture} />}
          {mode !== 'posture' && (
            <section className="panel">
              <h3>Amplitudes en direct</h3>
              <p className="muted small">L’articulation qui bouge est détectée seule. Cliquez une valeur pour la verrouiller.</p>
              <JointGrid analysis={analysis} onSelect={setFocus} />
            </section>
          )}
          <section className="panel help">
            <h3>Comment tester</h3>
            <ol>
              <li>Le patient démo enchaîne genou D, genou G, coude D (avec compensation du tronc) puis épaule D.</li>
              <li>Après une boucle (~40 s), cliquez <b>Enregistrer</b>, puis <b>Bilan →</b>.</li>
              <li>Activez le <b>Fantôme</b> pour comparer à la séance précédente (amplitudes plus faibles).</li>
              <li>Essayez les modes Sport, Pédiatrie et Posturo.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
