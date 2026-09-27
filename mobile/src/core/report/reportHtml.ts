import { JOINT_KINDS, JOINT_KIND_LABELS, JOINTS_BY_ID, jointId, type JointId } from '../joints';
import { jointHistory, type Patient, type Session } from '../model';
import { ageAt, compareToNorm, normFor, type NormStatus } from '../norms';
import { LSI_RETURN_TO_SPORT, symmetries } from '../sport';
import { evolutionChartSvg } from './chart';
import { escapeHtml, formatDateFr } from './escape';

export interface ReportPhoto {
  /** data:image/jpeg;base64,… (embarquée pour un PDF autonome). */
  dataUri: string;
  caption: string;
}

export interface ReportInput {
  patient: Patient;
  session: Session;
  /** Toutes les séances du patient (pour l'évolution), séance courante incluse. */
  history: Session[];
  practitioner: { name: string; title: string };
  photos: ReportPhoto[];
  generatedAt: Date;
}

const STATUS_LABEL: Record<NormStatus, string> = {
  normal: '● Normale',
  limited: '▲ Limitée',
  severe: '■ Très limitée',
};

const SEX_LABEL = { F: 'Femme', M: 'Homme' } as const;

function signed(v: number): string {
  return `${v > 0 ? '+' : ''}${Math.round(v)}°`;
}

function measuresSection(input: ReportInput, age: number): string {
  const { session, patient } = input;
  const ids = Object.keys(session.joints) as JointId[];
  if (ids.length === 0) return '';
  const rows = JOINT_KINDS.flatMap((kind) =>
    (['left', 'right'] as const)
      .map((side) => session.joints[jointId(kind, side)])
      .filter((r) => r !== undefined)
      .map((r) => {
        const def = JOINTS_BY_ID[r.jointId];
        const norm = normFor(kind, age, patient.sex);
        const cmp = compareToNorm(r.peak, norm);
        const minCol = def.convention === 'dorsiflexion' ? `${signed(r.min)} (plantaire)` : `${Math.round(r.min)}°`;
        return `<tr>
          <td>${escapeHtml(def.label)}</td>
          <td>${escapeHtml(def.movement)}</td>
          <td class="num strong">${def.convention === 'dorsiflexion' ? signed(r.peak) : `${Math.round(r.peak)}°`}</td>
          <td class="num">${minCol}</td>
          <td class="num">${norm.max}°</td>
          <td class="num">${cmp.percent} %</td>
          <td class="status ${cmp.status}">${STATUS_LABEL[cmp.status]}</td>
        </tr>`;
      }),
  );
  return `<section>
    <h2>Amplitudes articulaires mesurées</h2>
    <table>
      <thead><tr><th>Articulation</th><th>Mouvement</th><th class="num">Amplitude max</th><th class="num">Min. / extension</th><th class="num">Norme</th><th class="num">% norme</th><th>Statut</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <p class="note">Normes indicatives pour ${escapeHtml(SEX_LABEL[patient.sex].toLowerCase())}, tranche ${escapeHtml(normFor('knee', age, patient.sex).ageBandLabel)}. Statut : ≥ 90 % normale, 70-89 % limitée, &lt; 70 % très limitée.</p>
  </section>`;
}

function symmetrySection(session: Session): string {
  const values: Partial<Record<JointId, number>> = {};
  for (const [id, r] of Object.entries(session.joints)) values[id as JointId] = r!.peak;
  const sym = symmetries(values);
  if (sym.length === 0) return '';
  const rows = sym
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.label)}</td>
        <td class="num">${Math.round(s.left)}°</td>
        <td class="num">${Math.round(s.right)}°</td>
        <td class="num strong">${s.lsi} %</td>
        <td class="num">${s.asymmetryPercent} %</td>
        <td class="status ${s.lsi >= LSI_RETURN_TO_SPORT ? 'normal' : 'limited'}">${
          s.weakerSide === null ? '● Symétrique' : `${s.lsi >= LSI_RETURN_TO_SPORT ? '●' : '▲'} Déficit ${s.weakerSide === 'left' ? 'gauche' : 'droit'}`
        }</td>
      </tr>`,
    )
    .join('');
  return `<section>
    <h2>Symétrie gauche / droite</h2>
    <table>
      <thead><tr><th>Articulation</th><th class="num">Gauche</th><th class="num">Droite</th><th class="num">LSI</th><th class="num">Asymétrie</th><th>Interprétation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">LSI (Limb Symmetry Index) = côté faible / côté fort. Critère usuel de reprise sportive : LSI ≥ ${LSI_RETURN_TO_SPORT} %.</p>
  </section>`;
}

function evolutionSection(input: ReportInput, age: number): string {
  const charts = JOINT_KINDS.flatMap((kind) => {
    const left = jointHistory(input.history, jointId(kind, 'left'));
    const right = jointHistory(input.history, jointId(kind, 'right'));
    if (left.length === 0 && right.length === 0) return [];
    const series = [
      ...(left.length ? [{ key: 'left' as const, label: 'Gauche', points: left }] : []),
      ...(right.length ? [{ key: 'right' as const, label: 'Droite', points: right }] : []),
    ];
    return [
      `<figure>${evolutionChartSvg({
        title: `${JOINT_KIND_LABELS[kind]} — ${JOINTS_BY_ID[jointId(kind, 'left')].movement.toLowerCase()}`,
        series,
        norm: normFor(kind, age, input.patient.sex).max,
      })}</figure>`,
    ];
  });
  if (charts.length === 0) return '';
  const sessionsCount = new Set(input.history.map((s) => s.date)).size;
  return `<section>
    <h2>Évolution des amplitudes (${sessionsCount} séance${sessionsCount > 1 ? 's' : ''})</h2>
    <div class="charts">${charts.join('')}</div>
  </section>`;
}

function sportSection(session: Session): string {
  if (session.sport.length === 0) return '';
  const rows = session.sport
    .map(
      (s) => `<tr>
        <td>${escapeHtml(JOINTS_BY_ID[s.jointId].label)}</td>
        <td class="num">${s.count}</td>
        <td class="num">${s.meanRange}°</td>
        <td class="num">${s.meanDurationS.toFixed(2)} s</td>
        <td class="num">${s.meanPeakVelocity} °/s</td>
        <td class="num strong">${s.bestPeakVelocity} °/s</td>
      </tr>`,
    )
    .join('');
  return `<section>
    <h2>Performance — vitesse d'exécution</h2>
    <table>
      <thead><tr><th>Articulation</th><th class="num">Répétitions</th><th class="num">Amplitude moy.</th><th class="num">Durée moy.</th><th class="num">Vitesse max moy.</th><th class="num">Meilleure vitesse</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function postureSection(session: Session): string {
  if (session.posture.length === 0) return '';
  const blocks = session.posture
    .map((p) => {
      const rows = p.metrics
        .map(
          (m) => `<tr>
            <td>${escapeHtml(m.label)}</td>
            <td class="num strong">${m.value}${m.unit === '°' ? '°' : ' %'}</td>
            <td>${escapeHtml(m.detail)}</td>
            <td class="status ${m.status === 'ok' ? 'normal' : 'limited'}">${m.status === 'ok' ? '● Aligné' : '▲ À surveiller'}</td>
          </tr>`,
        )
        .join('');
      return `<h3>Vue ${p.view === 'front' ? 'de face' : 'de profil'}</h3>
        <table><thead><tr><th>Critère</th><th class="num">Valeur</th><th>Détail</th><th>Statut</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  return `<section><h2>Analyse posturale</h2>${blocks}</section>`;
}

function notesSection(session: Session): string {
  if (session.notes.length === 0) return '';
  const dictated = session.notes.flatMap((n) => n.measures);
  const pains = session.notes.flatMap((n) => n.pain);
  const observations = session.notes.flatMap((n) => n.observations);

  const measuresTable = dictated.length
    ? `<h3>Mesures dictées</h3><table><thead><tr><th>Région</th><th>Côté</th><th>Mouvement</th><th class="num">Valeur</th></tr></thead><tbody>${dictated
        .map(
          (m) => `<tr><td>${escapeHtml(m.region)}</td><td>${m.side === 'left' ? 'Gauche' : m.side === 'right' ? 'Droit' : '—'}</td><td>${escapeHtml(m.movement)}</td><td class="num strong">${escapeHtml(m.value)}°</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  const painList = pains.length
    ? `<h3>Douleur</h3><ul>${pains
        .map(
          (p) => `<li>Douleur <strong>${escapeHtml(p.level)}</strong>${p.eva !== null ? ` (EVA ${p.eva}/10)` : ''}${p.context ? ` ${escapeHtml(p.context)}` : ''}</li>`,
        )
        .join('')}</ul>`
    : '';
  const obsList = observations.length
    ? `<h3>Observations</h3><ul>${observations.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>`
    : '';
  const transcript = `<details open><summary>Transcription intégrale</summary>${session.notes
    .map((n) => `<p class="transcript">« ${escapeHtml(n.raw)} »</p>`)
    .join('')}</details>`;
  return `<section><h2>Observations du praticien</h2>${measuresTable}${painList}${obsList}${transcript}</section>`;
}

function photosSection(photos: ReportPhoto[]): string {
  if (photos.length === 0) return '';
  return `<section class="photos-section"><h2>Captures des mesures clés</h2><div class="photos">${photos
    .map(
      (p) => `<figure><img src="${escapeHtml(p.dataUri)}" alt="${escapeHtml(p.caption)}"/><figcaption>${escapeHtml(p.caption)}</figcaption></figure>`,
    )
    .join('')}</div></section>`;
}

const STYLES = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0b0b0b; font-size: 11px; line-height: 1.45; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0b0b0b; padding-bottom: 8px; margin-bottom: 12px; }
  header h1 { font-size: 20px; margin: 0 0 2px; }
  header .meta { text-align: right; color: #52514e; }
  .patient { display: grid; grid-template-columns: repeat(4, auto); gap: 4px 18px; background: #f3f2ef; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
  .patient b { display: block; font-size: 9px; color: #52514e; text-transform: uppercase; letter-spacing: .04em; }
  section { margin-bottom: 14px; page-break-inside: avoid; }
  h2 { font-size: 14px; margin: 0 0 6px; border-left: 4px solid #2a78d6; padding-left: 6px; }
  h3 { font-size: 12px; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #52514e; border-bottom: 1px solid #b9b8b2; padding: 4px 6px; }
  td { border-bottom: 1px solid #e7e6e2; padding: 4px 6px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 700; }
  .status.normal { color: #1d6b2f; }
  .status.limited { color: #8a5a00; }
  .status.severe { color: #a3261f; font-weight: 700; }
  .note { color: #52514e; font-size: 9px; margin: 4px 0 0; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .charts figure { margin: 0; border: 1px solid #e7e6e2; border-radius: 8px; overflow: hidden; }
  .charts svg { width: 100%; height: auto; display: block; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .photos figure { margin: 0; }
  .photos img { width: 100%; border-radius: 6px; }
  .photos figcaption { font-size: 9px; color: #52514e; }
  .transcript { font-style: italic; color: #52514e; margin: 2px 0; }
  summary { font-weight: 700; font-size: 11px; margin-top: 6px; }
  footer { margin-top: 18px; border-top: 1px solid #b9b8b2; padding-top: 6px; color: #52514e; font-size: 9px; }
  .signature { margin-top: 24px; display: flex; justify-content: flex-end; }
  .signature div { width: 220px; border-top: 1px solid #0b0b0b; padding-top: 4px; text-align: center; }
`;

export function buildReportHtml(input: ReportInput): string {
  const { patient, session, practitioner, generatedAt } = input;
  const age = ageAt(patient.birthDate, session.date);
  const body = [
    measuresSection(input, age),
    symmetrySection(session),
    evolutionSection(input, age),
    sportSection(session),
    postureSection(session),
    notesSection(session),
    photosSection(input.photos),
  ]
    .filter(Boolean)
    .join('');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><title>Bilan ${escapeHtml(patient.lastName)} ${escapeHtml(formatDateFr(session.date))}</title><style>${STYLES}</style></head>
<body>
  <header>
    <div><h1>Bilan kinésithérapique</h1><div>${escapeHtml(practitioner.name)}${practitioner.title ? ` — ${escapeHtml(practitioner.title)}` : ''}</div></div>
    <div class="meta">Séance du ${escapeHtml(formatDateFr(session.date))}<br/>Édité le ${escapeHtml(formatDateFr(generatedAt.toISOString()))}</div>
  </header>
  <div class="patient">
    <div><b>Patient</b>${escapeHtml(patient.lastName.toUpperCase())} ${escapeHtml(patient.firstName)}</div>
    <div><b>Né(e) le</b>${escapeHtml(formatDateFr(patient.birthDate))}</div>
    <div><b>Âge</b>${age} ans</div>
    <div><b>Sexe</b>${escapeHtml(SEX_LABEL[patient.sex])}</div>
  </div>
  ${body || '<p>Aucune mesure enregistrée pour cette séance.</p>'}
  <div class="signature"><div>${escapeHtml(practitioner.name)}</div></div>
  <footer>Mesures réalisées par analyse vidéo sur l'appareil (MediaPipe Pose), sans transmission d'images. Valeurs indicatives à interpréter par le praticien ; elles ne remplacent pas un examen clinique. Document contenant des données de santé — confidentiel.</footer>
</body></html>`;
}
