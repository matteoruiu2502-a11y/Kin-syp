// Analyseur de dictée : transforme une phrase libre (FR surtout, NL / DE / EN en base) en lignes de devis.
// Déterministe et sans serveur. Principe : chaque information va dans SA case.
//   - client      : « pour Mme Peeters », « chez monsieur Dubois », « client Janssens »
//   - quantité    : nombre collé à une unité (« 12 mètres », « 6 heures ») ou nombre en tête (« 3 coudes », « deux mitigeurs »)
//   - spécification : nombres qui décrivent le produit restent dans le libellé (« tuyau cuivre 22 », « per 20 », « 600 par 1000 »)
//   - prix        : « à 45 euros », « 3 € du mètre », « 150 euros pièce », « forfait 800 euros »
//   - unité       : celle dictée, sinon celle suggérée par le prix (« de l'heure » → h)

export type ParsedLine = {
  label: string;
  qty: number;
  unit: string;
  price: number;
  priceGiven: boolean;
  qtyGiven: boolean; // la quantité a été dictée
  unitAmbiguous: boolean; // « mètres » : mètre linéaire ou carré selon le produit
};
export type ParsedQuote = { client: string | null; lines: ParsedLine[] };

// ── Nombres en toutes lettres ───────────────────────────────────────────────

const FR_UNITS: Record<string, number> = {
  zero: 0, zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};
const FR_TENS: Record<string, number> = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
// 1 à 10 en néerlandais, allemand et anglais (démo d'accueil)
const OTHER: Record<string, number> = {
  twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  zwei: 2, drei: 3, fünf: 5, sechs: 6, sieben: 7, neun: 9, zehn: 10,
  two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10,
};
// articles qui valent « 1 » seulement en tête de segment
const ARTICLE_ONE = new Set(["un", "une", "an", "one", "ein", "eine", "einen", "een"]);

const isFrNum = (w: string) => w in FR_UNITS || w in FR_TENS || w === "cent" || w === "cents" || w === "mille";

/** Valeur d'une suite de mots-nombres français (« quatre vingt douze » → 92, « deux cent trente » → 230). */
function frValue(words: string[]): number {
  let total = 0;
  let cur = 0;
  let prev = "";
  for (const w of words) {
    if (w === "et") continue;
    if (w === "mille") {
      total += (cur || 1) * 1000;
      cur = 0;
    } else if (w === "cent" || w === "cents") cur = (cur || 1) * 100;
    else if ((w === "vingt" || w === "vingts") && prev === "quatre") cur += 76; // 4 + 76 = 80
    else cur += FR_UNITS[w] ?? FR_TENS[w] ?? 0;
    prev = w;
  }
  return total + cur;
}

/** Convertit les nombres en toutes lettres (« douze », « quatre-vingt-dix », « deux cents ») en chiffres. */
export function digitize(text: string): string {
  // « quatre-vingt-dix » → « quatre vingt dix » (seulement si tous les morceaux sont des nombres)
  const unhyphen = text.replace(/[\p{L}]+(?:-[\p{L}]+)+/gu, (m) => (m.split("-").every((x) => isFrNum(x.toLowerCase())) ? m.replace(/-/g, " ") : m));
  const parts = unhyphen.split(/(\s+)/); // mots aux indices pairs, séparateurs aux indices impairs
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const w = parts[i].toLowerCase();
    if (OTHER[w] !== undefined) {
      out.push(String(OTHER[w]));
      i++;
      continue;
    }
    if (!isFrNum(w)) {
      out.push(parts[i]);
      i++;
      continue;
    }
    const words = [w];
    let last = i;
    for (;;) {
      const next = (parts[last + 2] ?? "").toLowerCase();
      if (isFrNum(next)) {
        words.push(next);
        last += 2;
      } else if (next === "et" && FR_TENS[words[words.length - 1]] !== undefined && ["un", "une", "onze"].includes((parts[last + 4] ?? "").toLowerCase())) {
        words.push("et", (parts[last + 4] ?? "").toLowerCase());
        last += 4;
      } else break;
    }
    if (words.length === 1 && (w === "un" || w === "une")) out.push(parts[i]); // article
    else out.push(String(frValue(words)));
    i = last + 1;
  }
  return out.join("");
}

// ── Unités ──────────────────────────────────────────────────────────────────

type UnitDef = { re: string; unit: string; ambiguous?: boolean };
const QTY_UNITS: UnitDef[] = [
  { re: "m²|m2|mètres? carrés?|metres? carres?|vierkante meters?|square met(?:er|re)s?|sqm|qm", unit: "m²" },
  { re: "m³|m3|mètres? cubes?|metres? cubes?|cubic met(?:er|re)s?", unit: "m³" },
  { re: "ml|lm|lfm|mètres? linéaires?|metres? lineaires?|linear met(?:er|re)s?|laufmeter", unit: "ml" },
  { re: "mètres?|metres?|mtr|m", unit: "ml", ambiguous: true },
  { re: "heures?|hours?|hrs?|h|stunden?|std|uur|uren", unit: "h" },
  { re: "demi-?journées?|demi-?jours?", unit: "j" },
  { re: "jours?|journées?|days?|tage?n?|dagen|dag|j", unit: "j" },
  { re: "kilos?|kilogrammes?|kg", unit: "kg" },
  { re: "tonnes?", unit: "t" },
  { re: "sacs?", unit: "sac" },
  { re: "rouleaux?", unit: "rouleau" },
  { re: "palettes?", unit: "palette" },
  { re: "lots?", unit: "lot" },
  { re: "forfaits?", unit: "forfait" },
  { re: "pièces?|pieces?|pcs?|unités?|unites?|stuks?|stück", unit: "u" },
];
const UNIT_ALT = QTY_UNITS.map((u) => u.re).join("|");
const unitOf = (raw: string): UnitDef | null => {
  const r = raw.trim().toLowerCase();
  return QTY_UNITS.find((u) => new RegExp(`^(?:${u.re})$`, "i").test(r)) ?? null;
};

// nombres qui décrivent un produit (jamais une quantité) : diamètres, dimensions, puissances, capacités…
const SPEC_UNITS = "mm|cm|ø|kw|kwh|w|a|ma|v|bar|pouces?|°|%|mbar|db|kva|litres?|l|liters?|liter|centim[èe]tres?|millim[èe]tres?|milliamp[èe]res?|watts?|volts?|amp[èe]res?|zentimeter|centimeter|milliampere";
// objets dont « litres » est une capacité et non une quantité
const CAPACITY_NOUNS = /chauffe-?eau|ballon|boiler|cumulus|cuve|r[ée]servoir|citerne|vase|accumulateur|warmwaterboiler|speicher/i;

const NUM = String.raw`\d+(?:[.,]\d+)?`;
// gestes qui précèdent le produit : « pose de », « fourniture et pose de », « remplacement des »
const ACTION_PREFIX = String.raw`(?:(?:installation|installer|pose|poser|fourniture|fournir|remplacement|remplacer|changement|changer|d[ée]pose|mise en place|cr[ée]ation|r[ée]fection)\s+(?:et\s+\p{L}+\s+)?(?:de\s+|d')?(?:la |le |les |l')?)?`;
const toNum = (s: string) => parseFloat(s.replace(/\s/g, "").replace(",", "."));

// ── Client ──────────────────────────────────────────────────────────────────

const TITLES = String.raw`(?:madame|monsieur|mademoiselle|mme|mlle|mr|m\.|m|dhr\.?|mevr\.?|mevrouw|meneer|frau|herrn?|herr|famille|familie|villa|soci[ée]t[ée]|entreprise|sprl|srl|sa|nv|bv|asbl|syndic)`;
const TITLE_RE = new RegExp(`^${TITLES}$`, "i");
const NAME_STOP = new Set(["et", "pour", "avec", "il", "elle", "on", "je", "faut", "veut", "souhaite", "demande", "le", "la", "les", "un", "une", "des", "du", "de", "d", "au", "aux", "à", "en", "dans", "sur", "chez", "remplacer", "installer", "poser", "faire", "refaire", "changer", "rénovation", "renovation", "installation", "pose", "remplacement", "travaux", "devis", "chantier", "dépose", "depose", "fourniture", "voor", "met", "und", "mit", "für", "der", "die", "das", "van", "het", "een", "in", "te", "bij"]);
const PARTICLES = new Set(["de", "d'", "van", "von", "der", "den", "ten", "ter", "du", "le", "la", "&"]);
const CIVILITY: [RegExp, string][] = [
  [/^(?:madame|mme|mevr\.?|mevrouw|frau)$/i, "Mme"],
  [/^(?:mademoiselle|mlle)$/i, "Mlle"],
  [/^(?:monsieur|mr|m\.?|dhr\.?|meneer|herrn?|herr)$/i, "M."],
];

const isCap = (t: string) => /^\p{Lu}/u.test(t);
const capWords = (w: string) => w.replace(/(^|[\s'’-])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());

/** Nom du client dicté, où qu'il soit dans la phrase ; renvoie aussi le texte restant. */
export function extractClient(text: string): { client: string | null; rest: string } {
  const start = /^\s*(?:(?:c'est|ceci est)\s+)?(?:(?:un\s+|le\s+)?(?:devis|chantier|offre)\s+)?(?:pour|chez|client(?:e)?\s*:?|de la part de|voor|für)\s+(?:le client\s+|la cliente?\s+|la\s+(?=famille|villa|soci)|le\s+(?=syndic))?/iu;
  const mid = new RegExp(String.raw`(?:^|[,;.]\s*|\s)(?:c'est\s+)?(?:pour|chez|client(?:e)?\s*:?|le client\s+(?:c'est|est)|la cliente?\s+(?:c'est|est))\s+(?=(?:${TITLES}\s)|\p{Lu})`, "iu");
  let before = "";
  let from: number;
  const ms = text.match(start);
  if (ms) from = ms[0].length;
  else {
    const mm = text.match(mid);
    if (!mm || mm.index === undefined) return { client: null, rest: text };
    before = text.slice(0, mm.index);
    from = mm.index + mm[0].length;
  }
  const tail = text.slice(from);
  const toks = [...tail.matchAll(/[\p{L}][\p{L}'’.-]*|[,;:]|\d+\S*|\S/gu)];
  let hasTitle = false;
  let titleTok = "";
  let k = 0;
  if (toks[0] && TITLE_RE.test(toks[0][0].replace(/\.$/, "")) && toks[1] && /^[\p{L}]/u.test(toks[1][0])) {
    hasTitle = true;
    titleTok = toks[0][0];
    k = 1;
  }
  const core: string[] = [];
  let end = k > 0 ? toks[0][0].length + (toks[0].index ?? 0) : 0;
  while (k < toks.length && core.length < 4) {
    const t = toks[k][0];
    if (!/^\p{L}[\p{L}'’.-]*$/u.test(t)) break;
    const low = t.toLowerCase();
    if (PARTICLES.has(low) && toks[k + 1] && isCap(toks[k + 1][0]) && (core.length > 0 || hasTitle)) {
      core.push(t);
    } else {
      if (NAME_STOP.has(low)) break;
      if (!hasTitle && !isCap(t)) break; // sans titre, le nom exige une majuscule (« chez Dubois »)
      if (core.length >= 1 && !isCap(t)) break;
      core.push(t);
    }
    end = (toks[k].index ?? 0) + t.length;
    k++;
  }
  if (!core.length) return { client: null, rest: text };
  // lieu après le nom (« … Peeters in Gent, … », « … Dubois à Namur, … ») : retiré de la phrase
  const afterName = tail.slice(end);
  const place = afterName.match(/^\s+(?:à|in|te|bij)\s+\p{Lu}[\p{L}'’-]*(?:[ -]\p{Lu}[\p{L}'’-]*)*/u);
  if (place) end += place[0].length;
  const civ = hasTitle ? CIVILITY.find(([re]) => re.test(titleTok.replace(/\.$/, "")))?.[1] : undefined;
  const label = [hasTitle ? (civ ?? capWords(titleTok.replace(/\.$/, ""))) : "", capWords(core.join(" "))].filter(Boolean).join(" ");
  const rest = `${before} ${tail.slice(end)}`.replace(/^[\s,;:.-]+/, "").replace(/\s+/g, " ").trim();
  return { client: label, rest };
}

// ── Prix ────────────────────────────────────────────────────────────────────

const PRICE_UNIT_HINT: [RegExp, string][] = [
  [/(?:l'|de l'|par |\/\s*)heure|(?:de|par)\s+heure|\/\s*h\b/i, "h"],
  [/(?:du|le|par|au)\s+m[èe]tre(?:\s+lin[ée]aire)?|\/\s*ml\b|(?:du|le|par)\s+ml\b/i, "ml"],
  [/(?:du|le|par|au)\s+(?:m²|m2|m[èe]tre carr[ée])|\/\s*m²/i, "m²"],
  [/(?:du|le|par|au)\s+(?:m³|m3|m[èe]tre cube)/i, "m³"],
  [/(?:par|le|la|de la|à la)\s+(?:journ[ée]e|jour)|\/\s*j\b/i, "j"],
  [/(?:du|le|par)\s+kilo|\/\s*kg\b/i, "kg"],
  [/pi[èe]ce|chacune?|l'unit[ée]|unitaire|\/\s*u\b|(?:la|par)\s+pi[èe]ce/i, "u"],
];

type PriceHit = { price: number; unit: string | null; total: boolean; raw: string };

function takePrice(seg: string): { seg: string; hit: PriceHit | null } {
  const END = String.raw`(?![\p{L}\d])`;
  const perUnit = String.raw`(?:de l'|de la |du |le |la |par |au |à l'|à la |l'|/)\s*(?:heure|h|m[èe]tre(?:\s+lin[ée]aire)?|ml|m²|m2|m[èe]tre carr[ée]|m³|m3|jour(?:n[ée]e)?|j|kilo|kg|pi[èe]ce|unit[ée]|u)${END}`;
  const unitTail = String.raw`(?:\s*(?:ht|htva|hors tva|tvac|ttc|hors taxes?)${END})?(?:\s*${perUnit}|\s+(?:pi[èe]ce|chacune?|l'unit[ée]|unitaire)${END})?`;
  const euro = String.raw`(${NUM})\s*(?:€|euros?${END}|eur${END})`;
  const lead = String.raw`(?:(?:^|[^\p{L}\d])(?:à|a|au prix de|au tarif de|prix\s*:?|tarif\s*:?|pour|@|=|de|d')\s*)?`;
  const patterns: RegExp[] = [
    new RegExp(`${lead}${euro}${unitTail}`, "iu"),
    // sans « euros » : « à 55 de l'heure », « à 3 du mètre »
    new RegExp(String.raw`(?:^|[^\p{L}\d])(?:à|a|au prix de|@)\s*(${NUM})\s*(?:${perUnit})`, "iu"),
  ];
  for (const re of patterns) {
    const m = seg.match(re);
    if (!m) continue;
    const price = toNum(m[1]);
    if (!Number.isFinite(price)) continue;
    // le caractère qui précède (espace, virgule) reste dans la phrase
    const keep = /^[^\p{L}\d]/u.test(m[0]) && m[0].length > 1 ? m[0][0] : "";
    const after = keep ? m[0].slice(1) : m[0];
    const startAt = (m.index ?? 0) + keep.length;
    let unit: string | null = null;
    for (const [hint, u] of PRICE_UNIT_HINT) if (hint.test(after)) unit = u;
    const before = seg.slice(0, startAt);
    const afterText = seg.slice(startAt + after.length);
    const total = /\bforfait/i.test(before + after) || /\b(?:au total|le tout|en tout|global|forfaitaire|tout compris)\b/i.test(afterText) || /^\s*(?:de |d')?(?:forfait)\b/i.test(afterText);
    return { seg: `${before} ${afterText}`.replace(/\s+/g, " ").trim(), hit: { price, unit, total, raw: after } };
  }
  return { seg, hit: null };
}

// ── Libellés ────────────────────────────────────────────────────────────────

const LEADING_FILLER = /^(?:(?:il|on|je|nous)\s+(?:faut|faudra|faudrait|veut|veux|voudrais|met|mets|prévoit|prévoir|compte|va|vais)\s+|(?:il y a|il y aura|y a)\s+|ajoute(?:z)?|rajoute(?:z)?|mets|mettre|prévoir|prévois|compter|compte|avec|ensuite|également|aussi|en plus|sans oublier|plus|puis|et|ainsi que|ou|donc|alors|ah|euh|bon|le client veut|il veut)\b[\s,:]*/i;
const GENERIC_LABOUR = /^(?:de\s+|d')?(?:werk|arbeit|arbeitszeit|arbeidsloon|arbeid|labou?r|travail|travaux|main[ -]?d.?[oœ]euvre|mo|prestations?|intervention|manoeuvre|manœuvre|plomberie|[ée]lectricit[ée]|peinture|ma[cç]onnerie|menuiserie|carrelage|chauffage|jardinage|pose|ouvrier|ouvriers|techniciens?|chantier)$/i;

const PURE_LABOUR = /^(?:de\s+|d')?(?:werk|arbeit|arbeitszeit|arbeidsloon|arbeid|labou?r|travail|travaux|main[ -]?d.?[oœ]euvre|mo|prestations?|intervention|chantier|pose|ouvriers?|techniciens?)$/i;

function cleanLabel(raw: string) {
  let s = raw.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 4; i++) {
    const next = s.replace(LEADING_FILLER, "").trim();
    if (next === s) break;
    s = next;
  }
  s = s.replace(/^(?:de\s+la\s+|de\s+l'\s*|de\s+|du\s+|des\s+|d'\s*|la\s+|le\s+|les\s+|l'\s*|un\s+|une\s+|chez\s+)+/i, "");
  s = s.replace(/\s+(?:de|du|des|d'|à|a|au|aux|en|pour|et)$/i, "").replace(/[,;:.]+$/g, "");
  // « sur de murs », « terrasse de dans une construction », « plafond de en mat » : mots de liaison laissés par la quantité retirée
  s = s.replace(/\bsur\s+(?:de\s+|du\s+|des\s+|d')(?=\p{L})/giu, "sur ").replace(/\s+(?:de|du|d')\s+(?=(?:en|sur|à|dans|pour|avec)(?![\p{L}]))/giu, " ");
  s = s.replace(/\b(d'|l')\s+/gi, "$1").replace(/\s{2,}/g, " ").trim();
  return s;
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Prix par défaut de la démo d'accueil (jamais utilisés dans l'espace artisan, qui prend le catalogue).
const DEFAULT_PRICES: [RegExp, number][] = [
  [/main d.?œuvre|main d.?oeuvre|labou?r|arbeitszeit|arbeidsloon|heures?|hours?|stunden|uur/i, 50],
  [/carrel|tiling|tiles?|fliesen/i, 40],
  [/peint|paint|streich|anstrich/i, 22],
  [/parquet|floor|parkett/i, 45],
  [/prise|socket|steckdose/i, 38],
  [/plinthe|skirting|sockelleiste/i, 9],
];

// ── Segmentation ────────────────────────────────────────────────────────────

// « fourniture et pose », « dépose et repose », « installation et mise en service » : un seul poste
const BEFORE_ET = /(?:^|\s)(?:fournitures?|d[ée]pose|pose|installation|raccordement)\s*$/i;
const AFTER_ET = /^\s*(?:pose|repose|installation|mise|raccordement|branchement|fournitures?|r[ée]glage|essais?)(?![\p{L}])/iu;

function splitSegments(text: string): string[] {
  // découpe sur virgules, points-virgules, « puis », « plus », « ensuite », « ainsi que » et « et » (sauf « fourniture et pose »)
  const out: string[] = [];
  let buf = "";
  const nl = /\b(?:voor|het|een|van|uur|uren|stuks|meneer|mevrouw|plaatsing|vervanging)\b/i.test(text);
  const tokens = text.split(new RegExp(String.raw`(\s*[,;]\s*|\s+(?:et|puis|plus|ensuite|ainsi que|en plus|également|aussi|sans oublier|and|then|und|dann|sowie|daarna${nl ? "|en" : ""})\s+)`, "i"));
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const isSep = i % 2 === 1;
    if (!isSep) {
      buf += t;
      continue;
    }
    const sep = t.trim().toLowerCase();
    if (sep === "et" && ((BEFORE_ET.test(buf) && AFTER_ET.test(tokens[i + 1] ?? "")) || /^\s*demi/i.test(tokens[i + 1] ?? ""))) {
      buf += t;
      continue;
    }
    // « et » dans une dimension (« 600 et 1000 ») : pas de coupure entre deux nombres isolés
    if (sep === "et" && /\d\s*$/.test(buf) && /^\s*\d+\s*$/.test(tokens[i + 1] ?? "")) {
      buf += t;
      continue;
    }
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/[^\p{L}\d]/gu, "").length > 1);
}

// ── Analyse d'un segment ────────────────────────────────────────────────────

function parseSegment(original: string, labourLabel: string): ParsedLine | null {
  let work = original.trim();
  // « une heure et demie », « 2 heures et demie », « demi-journée »
  work = work.replace(new RegExp(String.raw`(${NUM})\s*(${UNIT_ALT})\s+et\s+demi(?:e|s)?\b`, "i"), (_m, n: string, u: string) => `${toNum(n) + 0.5} ${u}`);
  work = work.replace(/\bune\s+(heure|journ[ée]e|jour|m[èe]tre)\s+et\s+demi(?:e)?\b/i, (_m, u: string) => `1.5 ${u}`);
  work = work.replace(/\bdemi[- ]?(heure|journ[ée]e|jour)\b/i, (_m, u: string) => `0.5 ${u}`);
  work = work.replace(/\b(?:une\s+)?douzaine\b/i, "12 pièces").replace(/\b(?:une\s+)?dizaine\b/i, "10 pièces").replace(/\b(?:une\s+)?quinzaine\b/i, "15 pièces");

  // prix
  const priced = takePrice(work);
  work = priced.seg;
  const price = priced.hit;

  // quantité : nombre + unité de quantité (hors spécifications), sinon nombre en tête
  let qty: number | null = null;
  let unit: string | null = null;
  let unitAmbiguous = false;
  const re = new RegExp(String.raw`(^|[^\p{L}\d.,])(${NUM})\s*(${UNIT_ALT}|${SPEC_UNITS})(?![\p{L}²³])`, "giu");
  for (const hit of work.matchAll(re)) {
    const [whole, before, amount, raw] = hit;
    const matched = whole.slice(before.length);
    const def = unitOf(raw);
    if (!def) {
      // unité de spécification (mm, kW, Ø…) : jamais une quantité. Litres : quantité sauf capacité d'un appareil.
      if (/^(?:litres?|l|liters?|liter)$/i.test(raw) && !CAPACITY_NOUNS.test(work)) {
        qty = toNum(amount);
        unit = "L";
        work = work.replace(matched, " ");
        break;
      }
      continue;
    }
    qty = toNum(amount);
    unit = def.unit;
    unitAmbiguous = !!def.ambiguous;
    work = work.replace(matched, " ");
    break;
  }
  let qtyGiven = qty !== null;

  // nombre en tête, éventuellement après un geste (« pose de 3 châssis ») : « 3 coudes », « 2 robinets d'arrêt »
  // (pas « 600 par 1000 », « 90×120 », « 22 mm »)
  if (qty === null) {
    const lead = work.match(new RegExp(String.raw`^(${ACTION_PREFIX})(?:(?:l'|la |le |les |un |une )\s*)?(${NUM})\s+(?!(?:${SPEC_UNITS})(?![\p{L}])|par\s+\d|x\s*\d|×|fois\b)(?=\p{L})`, "iu"));
    if (lead && lead[2]) {
      qty = toNum(lead[2]);
      work = `${lead[1]}${work.slice(lead[0].length)}`;
      qtyGiven = true;
    }
  }
  // article « un / une / een / ein » en tête = 1 (dicté)
  if (qty === null) {
    const art = work.match(/^(?:(?:installation|pose|fourniture|remplacement|changement|mise en place)\s+(?:et\s+\w+\s+)?(?:de\s+|d')?)?(un|une|an|one|ein|eine|einen|een)\s+/i);
    if (art && ARTICLE_ONE.has(art[1].toLowerCase())) {
      qty = 1;
      qtyGiven = true;
    }
  }

  // forfait : prix global
  let finalUnit = unit;
  let finalQty = qty;
  if (price?.total && qty === null) {
    finalQty = 1;
    finalUnit = "forfait";
    qtyGiven = true;
  } else if (price?.unit && !unit) {
    finalUnit = price.unit;
  }

  let label = cleanLabel(work);
  const unitFinal = finalUnit ?? "u";
  if (unitFinal === "forfait") label = label.replace(/^(?:un\s+)?forfait\s+(?:de\s+|d')?/i, "");
  if (unitFinal === "h" && (!label || GENERIC_LABOUR.test(label.trim()))) {
    // « 8 heures de travail » → main-d'œuvre ; « 6 heures de plomberie » → main-d'œuvre plomberie
    label = !label || PURE_LABOUR.test(label.trim()) ? labourLabel : `${labourLabel} ${label.replace(/^(?:de\s+|d')/i, "")}`;
  }
  if (price?.total && !label) label = "Forfait";
  if (!label) return null;

  const priceGiven = !!price;
  const qtyOut = finalQty ?? 1;
  let priceOut = price?.price ?? NaN;
  if (!priceGiven) priceOut = DEFAULT_PRICES.find(([r]) => r.test(original))?.[1] ?? 50;
  return { label: capitalize(label), qty: Number.isFinite(qtyOut) ? qtyOut : 1, unit: unitFinal, price: priceOut, priceGiven, qtyGiven, unitAmbiguous: unitAmbiguous && !price?.unit };
}

export function parseQuote(text: string, labourLabel: string): ParsedQuote {
  const digits = digitize(text.trim());
  const { client, rest } = extractClient(digits);
  const lines: ParsedLine[] = [];
  for (const seg of splitSegments(rest)) {
    const line = parseSegment(seg, labourLabel);
    if (line) lines.push(line);
  }
  return { client, lines };
}
