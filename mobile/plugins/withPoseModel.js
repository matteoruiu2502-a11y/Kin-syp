/**
 * Plugin Expo : embarque le modèle MediaPipe dans les binaires natifs.
 *  - Android : android/app/src/main/assets/ (lu via setModelAssetPath)
 *  - iOS     : ressource du bundle principal (lu via Bundle.main.path)
 * L'inférence reste 100 % locale : aucun flux vidéo ne quitte l'appareil.
 */
const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

const { POSE_MODEL_FILE } = require('../pose-model.config');

function modelSourcePath(projectRoot) {
  const src = path.join(projectRoot, 'assets', 'models', POSE_MODEL_FILE);
  if (!fs.existsSync(src)) {
    throw new Error(
      `[withPoseModel] ${POSE_MODEL_FILE} introuvable dans assets/models. Lancez "npm run fetch-model".`,
    );
  }
  return src;
}

const withAndroidModel = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const src = modelSourcePath(cfg.modRequest.projectRoot);
      const assetsDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(src, path.join(assetsDir, POSE_MODEL_FILE));
      return cfg;
    },
  ]);

const withIosModel = (config) =>
  withXcodeProject(config, (cfg) => {
    const { projectRoot, platformProjectRoot } = cfg.modRequest;
    const src = modelSourcePath(projectRoot);
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const destDir = path.join(platformProjectRoot, projectName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, POSE_MODEL_FILE));

    const project = cfg.modResults;
    const alreadyAdded = project.hasFile(`${projectName}/${POSE_MODEL_FILE}`);
    if (!alreadyAdded) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: `${projectName}/${POSE_MODEL_FILE}`,
        groupName: projectName,
        project,
        isBuildFile: true,
        verbose: true,
      });
    }
    return cfg;
  });

const withPoseModel = (config) => withIosModel(withAndroidModel(config));

module.exports = createRunOncePlugin(withPoseModel, 'with-pose-model', '1.0.0');
