/**
 * Conversion des nombres dictés en toutes lettres (0 à 999), tels que
 * renvoyés parfois par la reconnaissance vocale : "quatre-vingt-dix",
 * "cent vingt-cinq", "soixante et onze"…
 */
const UNITS: Record<string, number> = {
  zéro: 0, zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15,
  seize: 16,
};

const TENS: Record<string, number> = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

const NUMBER_WORDS = new Set([...Object.keys(UNITS), ...Object.keys(TENS), 'cent', 'cents', 'et']);

export function isNumberWord(word: string): boolean {
  return NUMBER_WORDS.has(word.toLowerCase());
}

/** Convertit une suite de mots en nombre ; null si la suite n'est pas un nombre valide. */
export function parseFrenchNumber(text: string): number | null {
  const words = text
    .toLowerCase()
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && w !== 'et');
  if (words.length === 0) return null;

  let total = 0;
  let current = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'cent' || w === 'cents') {
      total += (current === 0 ? 1 : current) * 100;
      current = 0;
    } else if (w === 'quatre' && (words[i + 1] === 'vingt' || words[i + 1] === 'vingts')) {
      current += 80;
      i++;
    } else if (w in TENS) {
      current += TENS[w];
    } else if (w in UNITS) {
      current += UNITS[w];
    } else {
      return null;
    }
  }
  return total + current;
}
