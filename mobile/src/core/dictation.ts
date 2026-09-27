import { isNumberWord, parseFrenchNumber } from './frenchNumbers';
import { jointId, type JointId, type JointKind, type Side } from './joints';

/**
 * Structuration des remarques dictées par le kiné.
 * Exemple : "Flexion genou droit 90°, légère douleur en fin de course"
 *   → mesure { genou D, flexion, 90° } + douleur { légère, en fin de course }.
 */
export type PainLevel = 'aucune' | 'légère' | 'modérée' | 'forte';

export interface DictatedMeasure {
  movement: string;
  /** Articulation reconnue (null si non gérée par la vision : poignet, rachis…). */
  region: string;
  side: Side | null;
  /** Identifiant d'articulation mesurable par la caméra, si applicable. */
  jointId: JointId | null;
  value: number;
}

export interface PainNote {
  level: PainLevel;
  /** Échelle visuelle analogique (0-10) si dictée. */
  eva: number | null;
  context: string | null;
}

export interface StructuredNote {
  id: string;
  createdAt: string;
  raw: string;
  measures: DictatedMeasure[];
  pain: PainNote[];
  /** Propositions restantes, sans mesure ni douleur : observations libres. */
  observations: string[];
}

const REGIONS: Array<{ pattern: RegExp; region: string; kind: JointKind | null }> = [
  { pattern: /\bepaules?\b/, region: 'Épaule', kind: 'shoulder' },
  { pattern: /\bcoudes?\b/, region: 'Coude', kind: 'elbow' },
  { pattern: /\bhanches?\b/, region: 'Hanche', kind: 'hip' },
  { pattern: /\bgenoux?\b/, region: 'Genou', kind: 'knee' },
  { pattern: /\bchevilles?\b/, region: 'Cheville', kind: 'ankle' },
  { pattern: /\bpoignets?\b/, region: 'Poignet', kind: null },
  { pattern: /\b(rachis|colonne|lombaire|cervical|dorsal)e?s?\b/, region: 'Rachis', kind: null },
];

const MOVEMENTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /flexion dorsale/, label: 'Flexion dorsale' },
  { pattern: /flexion plantaire/, label: 'Flexion plantaire' },
  { pattern: /rotation (interne|mediale)/, label: 'Rotation interne' },
  { pattern: /rotation (externe|laterale)/, label: 'Rotation externe' },
  { pattern: /\bflexion\b/, label: 'Flexion' },
  { pattern: /\bextension\b/, label: 'Extension' },
  { pattern: /\babduction\b/, label: 'Abduction' },
  { pattern: /\badduction\b/, label: 'Adduction' },
  { pattern: /\belevation\b/, label: 'Élévation' },
  { pattern: /\bpronation\b/, label: 'Pronation' },
  { pattern: /\bsupination\b/, label: 'Supination' },
];

const PAIN_CONTEXTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /fin de (course|mouvement|amplitude)/, label: 'en fin de course' },
  { pattern: /\ba l'effort|en charge/, label: "à l'effort" },
  { pattern: /au repos/, label: 'au repos' },
  { pattern: /\ba la palpation/, label: 'à la palpation' },
  { pattern: /nocturne|la nuit/, label: 'nocturne' },
  { pattern: /\ba la mise en tension|en etirement/, label: 'à la mise en tension' },
];

/**
 * Minuscules sans accents : les classes \b des RegExp JavaScript ne
 * reconnaissent pas les lettres accentuées comme des caractères de mot.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/[’`]/g, "'");
}

function detectSide(text: string): Side | null {
  if (/\b(droite?|droits?|D)\b/.test(text)) return 'right';
  if (/\b(gauches?|G)\b/.test(text)) return 'left';
  return null;
}

/** Première valeur numérique en degrés (chiffres ou lettres). */
function extractValue(text: string): number | null {
  const digits = text.match(/(-?\d+(?:[.,]\d+)?)\s*(°|degres?)?/);
  if (digits) return Number(digits[1].replace(',', '.'));
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const isNum = (w: string) => w.split('-').every(isNumberWord);
    if (!isNum(words[i]) || words[i] === 'et' || words[i] === 'un' || words[i] === 'une') continue;
    let j = i;
    while (j < words.length && isNum(words[j])) j++;
    const value = parseFrenchNumber(words.slice(i, j).join(' '));
    if (value !== null) return value;
  }
  return null;
}

function detectPain(text: string): PainNote | null {
  const negated = /\b(pas de|sans|aucune) douleurs?\b|\bindolore\b/.test(text);
  const hasPain = /\b(douleurs?|douloureu(x|se)|algique|gene)\b/.test(text);
  if (!negated && !hasPain) return null;

  const evaMatch = text.match(/\beva\s*(?:a|de)?\s*(\d{1,2})(?:\s*(?:\/|sur)\s*10)?/);
  const eva = evaMatch ? Math.min(10, Number(evaMatch[1])) : null;

  let level: PainLevel;
  if (negated) level = 'aucune';
  else if (/\b(legere|leger|faible|discrete)\b/.test(text)) level = 'légère';
  else if (/\b(forte|fort|intense|vive|importante|severe)\b/.test(text)) level = 'forte';
  else if (/\b(moderee|moyenne)\b/.test(text)) level = 'modérée';
  else if (eva !== null) level = eva === 0 ? 'aucune' : eva <= 3 ? 'légère' : eva <= 6 ? 'modérée' : 'forte';
  else level = 'modérée';

  const context = PAIN_CONTEXTS.find((c) => c.pattern.test(text))?.label ?? null;
  return { level, eva, context };
}

function splitClauses(text: string): string[] {
  return text
    .split(/[,;.\n]|\bet\b(?= (?:flexion|extension|abduction|adduction|rotation|douleur|genou|coude|épaule|epaule|hanche|cheville))/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

let noteCounter = 0;

export function parseDictation(raw: string, now: Date = new Date()): StructuredNote {
  const measures: DictatedMeasure[] = [];
  const pain: PainNote[] = [];
  const observations: string[] = [];
  type Region = (typeof REGIONS)[number];
  let lastRegion: Region | null = null;
  let lastSide: Side | null = null;

  for (const clause of splitClauses(raw)) {
    const lower = fold(clause);
    const region = REGIONS.find((r) => r.pattern.test(lower)) ?? null;
    const movement = MOVEMENTS.find((m) => m.pattern.test(lower)) ?? null;
    const side: Side | null = detectSide(clause) ?? (region ? null : lastSide);
    const painNote = detectPain(lower);
    // Une valeur n'est une mesure que si un mouvement est nommé ou l'unité
    // dictée ("genou droit 90 degrés") — jamais le score EVA.
    const withoutEva = lower.replace(/\beva\s*(?:a|de)?\s*\d{1,2}(?:\s*(?:\/|sur)\s*10)?/g, ' ');
    const hasUnit = /°|\bdegres?\b/.test(withoutEva);
    const value = movement || (region && hasUnit) ? extractValue(withoutEva) : null;

    // "Flexion genou droit 90°, extension 5°" : l'articulation est reprise.
    const effectiveRegion: Region | null = region ?? (movement ? lastRegion : null);
    if (effectiveRegion && value !== null) {
      const effectiveSide: Side | null = side ?? lastSide;
      measures.push({
        movement: movement?.label ?? 'Amplitude',
        region: effectiveRegion.region,
        side: effectiveSide,
        jointId:
          effectiveRegion.kind && effectiveSide ? jointId(effectiveRegion.kind, effectiveSide) : null,
        value,
      });
      lastRegion = effectiveRegion;
      lastSide = effectiveSide;
    } else if (region) {
      lastRegion = region;
      lastSide = side ?? lastSide;
    }

    if (painNote) pain.push(painNote);
    const consumed = (effectiveRegion && value !== null) || painNote;
    if (!consumed) observations.push(clause.charAt(0).toUpperCase() + clause.slice(1));
  }

  noteCounter += 1;
  return {
    id: `note-${now.getTime()}-${noteCounter}`,
    createdAt: now.toISOString(),
    raw: raw.trim(),
    measures,
    pain,
    observations,
  };
}

/** Vocabulaire transmis au moteur de reconnaissance pour améliorer la précision. */
export const DICTATION_CONTEXTUAL_STRINGS = [
  'flexion', 'extension', 'abduction', 'adduction', 'rotation interne', 'rotation externe',
  'flexion dorsale', 'flexion plantaire', 'genou', 'coude', 'épaule', 'hanche', 'cheville',
  'EVA', 'fin de course', 'degrés', 'droit', 'gauche', 'rachis', 'lombaire', 'cervical',
];
