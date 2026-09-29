// Copie les fichiers de l'OCR (Tesseract) dans public/ocr pour qu'il fonctionne sans CDN.
import { copyFileSync, mkdirSync } from "node:fs";

const out = "public/ocr";
mkdirSync(out, { recursive: true });
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz", "fra.traineddata.gz"],
];
for (const [from, to] of files) copyFileSync(from, `${out}/${to}`);
console.log(`OCR : ${files.length} fichiers copiés dans ${out}`);
