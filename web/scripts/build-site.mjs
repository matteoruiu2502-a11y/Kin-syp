/**
 * Copie la version web construite (dist/) dans le dossier app/ à la racine
 * du dépôt, publié par GitHub Pages à côté du site existant :
 *   https://matteoruiu2502-a11y.github.io/Kin-syp/app/
 * La variante WebAssembly « nosimd » (navigateurs anciens) est omise pour
 * alléger le dépôt.
 */
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '..', 'app');
rmSync(target, { recursive: true, force: true });
cpSync(join(root, 'dist'), target, {
  recursive: true,
  filter: (src) => !src.includes('nosimd'),
});
// Pas de traitement Jekyll : les fichiers sont servis tels quels.
writeFileSync(join(root, '..', '.nojekyll'), '');
console.log('app/ mis à jour');
