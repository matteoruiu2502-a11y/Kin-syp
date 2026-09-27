#!/usr/bin/env node
/**
 * Télécharge le modèle MediaPipe Pose Landmarker (33 repères) dans
 * assets/models/. Le fichier (~9 Mo) n'est pas versionné ; il est embarqué
 * dans l'app native par le plugin plugins/withPoseModel.js.
 *
 *   node scripts/fetch-pose-model.js            # échoue si le téléchargement échoue
 *   node scripts/fetch-pose-model.js --optional # (postinstall) avertit seulement
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const { POSE_MODEL_FILE, POSE_MODEL_URL } = require('../pose-model.config');

const optional = process.argv.includes('--optional');
const dest = path.join(__dirname, '..', 'assets', 'models', POSE_MODEL_FILE);

function download(url, file, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          resolve(download(res.headers.location, file, redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} pour ${url}`));
          return;
        }
        const tmp = `${file}.part`;
        const out = fs.createWriteStream(tmp);
        res.pipe(out);
        out.on('finish', () => out.close(() => fs.rename(tmp, file, (e) => (e ? reject(e) : resolve()))));
        out.on('error', reject);
      })
      .on('error', reject);
  });
}

(async () => {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    console.log(`[pose-model] déjà présent : ${path.relative(process.cwd(), dest)}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`[pose-model] téléchargement de ${POSE_MODEL_URL}`);
  try {
    await download(POSE_MODEL_URL, dest);
    console.log(`[pose-model] OK (${(fs.statSync(dest).size / 1e6).toFixed(1)} Mo)`);
  } catch (e) {
    const msg = `[pose-model] échec : ${e.message}. Relancez "npm run fetch-model".`;
    if (optional) {
      console.warn(msg);
    } else {
      console.error(msg);
      process.exit(1);
    }
  }
})();
