/**
 * Prépare les fichiers servis statiquement (non versionnés) :
 *  - public/mediapipe/ : runtime WebAssembly de MediaPipe Tasks Vision (copié depuis node_modules)
 *  - public/models/    : modèle Pose Landmarker "lite" (~5,6 Mo), rapide dans un navigateur
 * Tout s'exécute ensuite localement dans le navigateur : aucune image n'est envoyée.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { get } from 'node:https';
import { createWriteStream, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const optional = process.argv.includes('--optional');

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

const wasmDir = join(root, 'public', 'mediapipe');
mkdirSync(wasmDir, { recursive: true });
for (const f of WASM_FILES) {
  copyFileSync(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm', f), join(wasmDir, f));
}
console.log('[assets] runtime MediaPipe copié');

function download(url, dest, redirects = 5) {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(download(res.headers.location, dest, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const tmp = `${dest}.part`;
      const out = createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => (renameSync(tmp, dest), resolve())));
      out.on('error', reject);
    }).on('error', reject);
  });
}

const modelPath = join(root, 'public', 'models', 'pose_landmarker_lite.task');
mkdirSync(dirname(modelPath), { recursive: true });
if (existsSync(modelPath) && statSync(modelPath).size > 0) {
  console.log('[assets] modèle déjà présent');
} else {
  try {
    await download(MODEL_URL, modelPath);
    console.log('[assets] modèle téléchargé');
  } catch (e) {
    const msg = `[assets] échec du téléchargement du modèle (${e.message}). Relancez "npm run setup-assets".`;
    if (optional) console.warn(msg);
    else {
      console.error(msg);
      process.exit(1);
    }
  }
}
