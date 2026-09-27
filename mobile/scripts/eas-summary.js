/**
 * Résumé lisible d'un build EAS (sortie `eas build --json`) pour la page
 * GitHub Actions : lien de la page du build (QR code d'installation) et du fichier.
 */
const fs = require('fs');

const file = process.argv[2] ?? 'build.json';
const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const start = raw.indexOf('[');
const builds = start >= 0 ? JSON.parse(raw.slice(start)) : [];
const lines = ['## Application construite', ''];
for (const b of builds) {
  const owner = b.app?.ownerAccount?.name;
  const slug = b.app?.slug;
  const page = owner && slug ? `https://expo.dev/accounts/${owner}/projects/${slug}/builds/${b.id}` : 'https://expo.dev (onglet Builds)';
  lines.push(`- **${String(b.platform).toLowerCase()}** — statut : ${b.status}`);
  lines.push(`  - page du build, avec QR code à scanner depuis la tablette : ${page}`);
  if (b.artifacts?.buildUrl) lines.push(`  - fichier à installer : ${b.artifacts.buildUrl}`);
}
if (builds.length === 0) lines.push('Aucun build dans la sortie : voir les journaux ci-dessus.');
const text = lines.join('\n') + '\n';
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
