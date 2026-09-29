// Lecture de ticket de caisse (OCR Tesseract, dans le navigateur) : fournisseur, date, total TTC.

export type ReceiptGuess = { supplier: string; date: string; total: number | null; text: string };

const AMOUNT = /(\d{1,5}(?:[ .]\d{3})*[.,]\d{2})/g;
const toNum = (s: string) => parseFloat(s.replace(/[ .](?=\d{3}\b)/g, "").replace(",", "."));

export function guessFromText(text: string): ReceiptGuess {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let total: number | null = null;
  // priorité aux lignes « TOTAL TTC », « NET A PAYER », « TOTAL »
  for (const re of [/total\s*t\.?t\.?c/i, /net\s*[àa]\s*payer/i, /\btotal\b/i, /montant/i]) {
    const line = lines.find((l) => re.test(l) && AMOUNT.test(l));
    AMOUNT.lastIndex = 0;
    if (line) {
      const m = line.match(AMOUNT);
      if (m) total = toNum(m[m.length - 1]);
      break;
    }
  }
  if (total === null) {
    const all = [...text.matchAll(AMOUNT)].map((m) => toNum(m[1])).filter((n) => n < 100000);
    total = all.length ? Math.max(...all) : null;
  }
  const d = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{2,4})/);
  const date = d ? `${d[3].length === 2 ? `20${d[3]}` : d[3]}-${d[2]}-${d[1]}` : "";
  const supplier = (lines.find((l) => /[a-z]{3,}/i.test(l) && !/ticket|facture|caisse/i.test(l)) ?? "").slice(0, 40);
  return { supplier, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", total, text };
}

export async function readReceipt(image: Blob, onProgress?: (p: number) => void): Promise<ReceiptGuess> {
  const { createWorker } = await import("tesseract.js");
  // Fichiers servis par le site lui-même (scripts/copy-ocr.mjs) : aucun CDN nécessaire
  const base = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/ocr/`;
  const worker = await createWorker("fra", 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && onProgress?.(m.progress),
  });
  try {
    const { data } = await worker.recognize(image);
    return guessFromText(data.text);
  } finally {
    await worker.terminate();
  }
}
