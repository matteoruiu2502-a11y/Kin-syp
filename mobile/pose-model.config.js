/**
 * Source unique du modèle de détection squelettique, partagée par le script
 * de téléchargement, le plugin Expo et le code applicatif.
 * "full" : meilleur compromis précision / vitesse sur tablette (GPU).
 */
const POSE_MODEL_FILE = 'pose_landmarker_full.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

module.exports = { POSE_MODEL_FILE, POSE_MODEL_URL };
