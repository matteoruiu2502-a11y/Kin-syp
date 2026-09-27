/**
 * Assemble une version hébergeable en une page (dossier artifact/) à partir
 * du build Vite : la page (sans <html>/<head>, ajoutés par l'hébergeur), le
 * bundle JS, le runtime WebAssembly MediaPipe (variante SIMD) et le modèle.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'artifact');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'mediapipe'), { recursive: true });
mkdirSync(join(out, 'models'), { recursive: true });

const css = readFileSync(join(dist, 'app.css'), 'utf8');
const page = `<title>KinéSyP</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`;
writeFileSync(join(out, 'index.html'), page);
copyFileSync(join(dist, 'app.js'), join(out, 'app.js'));
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) {
  copyFileSync(join(dist, 'mediapipe', f), join(out, 'mediapipe', f));
}
// L'hébergeur ne sert pas les fichiers .task : le modèle est publié en base64 (texte).
writeFileSync(join(out, 'models', 'pose_landmarker_lite.b64.txt'), readFileSync(join(dist, 'models', 'pose_landmarker_lite.task')).toString('base64'));
console.log('artifact/ prêt');
