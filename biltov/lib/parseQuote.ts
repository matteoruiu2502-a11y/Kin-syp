// Mini-analyseur de dictée : transforme une phrase libre (FR / EN / DE) en lignes de devis.
// Volontairement simple et déterministe — il illustre ce que fait le moteur IA de Biltov.

export type ParsedLine = { label: string; qty: number; unit: string; price: number; priceGiven: boolean };
export type ParsedQuote = { client: string | null; lines: ParsedLine[] };

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(m²|m2|mètres? carrés?|vierkante meters?|square met(?:er|re)s?|sqm|qm)$/i, "m²"],
  [/^(m³|m3|mètres? cubes?|cubic met(?:er|re)s?)$/i, "m³"],
  [/^(ml|lm|lfm|mètres? linéaires?|linear met(?:er|re)s?|laufmeter)$/i, "ml"],
  [/^(h|heures?|hours?|hrs?|stunden?|std|uur|uren)$/i, "h"],
  [/^(jours?|days?|tage?n?|j|dagen|dag)$/i, "j"],
  [/^(stuks?|stück|pièces?|pcs?)$/i, "u"],
];

const UNIT_RE =
  "m²|m2|m³|m3|ml|lm|lfm|mètres? (?:carrés?|cubes?|linéaires?)|vierkante meter|square met(?:er|re)s?|linear met(?:er|re)s?|sqm|qm|heures?|hours?|hrs?|h|stunden?|std|uur|uren|jours?|days?|tage?n?|dagen|stuks?|stück";

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, a: 1, an: 1, one: 1, ein: 1, eine: 1, einen: 1,
  deux: 2, two: 2, zwei: 2, trois: 3, three: 3, drei: 3, quatre: 4, four: 4, vier: 4,
  cinq: 5, five: 5, "fünf": 5, six: 6, sechs: 6, dix: 10, ten: 10, zehn: 10,
  een: 1, twee: 2, drie: 3, vijf: 5, zes: 6, tien: 10,
};

// Prix par défaut quand la phrase n'en donne pas (mot-clé → € HT).
const DEFAULT_PRICES: [RegExp, number][] = [
  [/main d.?œuvre|main d.?oeuvre|labou?r|arbeitszeit|arbeidsloon|heures?|hours?|stunden|uur/i, 50],
  [/carrel|tiling|tiles?|fliesen/i, 40],
  [/peint|paint|streich|anstrich/i, 22],
  [/parquet|floor|parkett/i, 45],
  [/prise|socket|steckdose/i, 38],
  [/plinthe|skirting|sockelleiste/i, 9],
];

const toNumber = (raw: string) => {
  const n = parseFloat(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NUMBER_WORDS[raw.toLowerCase()] ?? NaN;
};

const normalizeUnit = (raw: string | undefined) => {
  if (!raw) return "u";
  for (const [re, unit] of UNIT_ALIASES) if (re.test(raw.trim())) return unit;
  return raw;
};

const STOPWORDS = new Set(["de", "d'", "du", "des", "of", "von", "der", "die", "das", "à", "a", "at", "zu", "für", "van", "het", "aan", "tegen"]);

/** « pose de   de parquet chêne à » → « pose de parquet chêne » */
function cleanLabel(raw: string) {
  const tokens = raw.replace(/d'\s*/gi, "d' ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (STOPWORDS.has(low) && (out.length === 0 || STOPWORDS.has(out[out.length - 1].toLowerCase()))) continue;
    out.push(tok);
  }
  while (out.length && STOPWORDS.has(out[out.length - 1].toLowerCase())) out.pop();
  return out.join(" ").replace(/d' /g, "d'");
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function parseQuote(text: string, labourLabel: string): ParsedQuote {
  let rest = text.trim();
  let client: string | null = null;

  // « Pour Mme Martin, … » / « For Mr Bernard, … » / « Für Herrn Bernard, … »
  const clientMatch = rest.match(/^(?:pour|for|für|voor)\s+([^,;:]+?)\s*[,;:]\s*/i);
  if (clientMatch) {
    client = clientMatch[1].trim().replace(/^(?:la|le|les|the|die|der|das|de|het)\s+/i, "");
    rest = rest.slice(clientMatch[0].length);
  }

  const segments = rest
    .split(/\s*[,;]\s*|\s+(?:et|puis|plus|and|then|und|dann|sowie|en|daarna)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const lines: ParsedLine[] = [];
  for (const segment of segments) {
    let working = segment;

    // Prix unitaire : « à 45 euros », « at 45 €», « zu 45 Euro »
    let price = NaN;
    const priceMatch = working.match(/(?:à|a|at|zu|für|aan|tegen|@)?\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)(?=\s|$|[.,;])/i);
    if (priceMatch) {
      price = toNumber(priceMatch[1]);
      working = working.replace(priceMatch[0], " ");
    }

    // Quantité + unité : « 24 m² », « 6 heures », « 3 prises »
    let qty = 1;
    let unit = "u";
    const qtyMatch = working.match(new RegExp(`(\\d+(?:[.,]\\d+)?|\\b(?:${Object.keys(NUMBER_WORDS).join("|")})\\b)\\s*(${UNIT_RE})?(?=\\s|$)`, "i"));
    if (qtyMatch) {
      const n = toNumber(qtyMatch[1]);
      if (Number.isFinite(n)) {
        qty = n;
        unit = normalizeUnit(qtyMatch[2]);
        working = working.replace(qtyMatch[0], " ");
      }
    }

    let label = cleanLabel(working);
    if (unit === "h" && (!label || /^(?:main d.?œuvre|labou?r|arbeitszeit|arbeidsloon|werk)?$/i.test(label))) label = labourLabel;
    if (!label) continue;

    const priceGiven = Number.isFinite(price);
    if (!priceGiven) price = DEFAULT_PRICES.find(([re]) => re.test(segment))?.[1] ?? 50;
    lines.push({ label: capitalize(label), qty, unit, price, priceGiven });
  }

  return { client, lines };
}
