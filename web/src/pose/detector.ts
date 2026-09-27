import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * MediaPipe Pose Landmarker exécuté dans le navigateur (WebAssembly + GPU
 * WebGL). Le runtime et le modèle sont servis avec la page : aucune image
 * ne quitte l'ordinateur.
 */
let instance: Promise<PoseLandmarker> | null = null;

function assetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

/**
 * Modèle : fichier .task en local ; sur un hébergement qui ne sert pas ce
 * type de fichier, repli sur une copie encodée en base64 (.b64.txt).
 */
async function loadModel(): Promise<Uint8Array> {
  const direct = await fetch(assetUrl('models/pose_landmarker_lite.task')).catch(() => null);
  if (direct?.ok) return new Uint8Array(await direct.arrayBuffer());
  const encoded = await fetch(assetUrl('models/pose_landmarker_lite.b64.txt'));
  if (!encoded.ok) throw new Error('modèle introuvable');
  const bin = atob((await encoded.text()).trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function create(): Promise<PoseLandmarker> {
  const [fileset, model] = await Promise.all([FilesetResolver.forVisionTasks(assetUrl('mediapipe')), loadModel()]);
  const options = {
    baseOptions: { modelAssetBuffer: model, delegate: 'GPU' as const },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  try {
    return await PoseLandmarker.createFromOptions(fileset, options);
  } catch {
    // GPU indisponible (WebGL bloqué) : repli sur le CPU.
    return PoseLandmarker.createFromOptions(fileset, { ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}

export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!instance) {
    instance = create().catch((e) => {
      instance = null;
      throw e;
    });
  }
  return instance;
}

let lastTs = 0;
/** Détection sur l'image courante d'une vidéo ; horodatage strictement croissant exigé. */
export function detect(landmarker: PoseLandmarker, video: HTMLVideoElement): PoseLandmarkerResult | null {
  let result: PoseLandmarkerResult | null = null;
  const ts = Math.max(performance.now(), lastTs + 1);
  lastTs = ts;
  landmarker.detectForVideo(video, ts, (r) => {
    // Le résultat n'est valide que pendant le rappel : on copie les données utiles.
    result = {
      landmarks: r.landmarks.map((l) => l.map((p) => ({ ...p }))),
      worldLandmarks: r.worldLandmarks.map((l) => l.map((p) => ({ ...p }))),
      segmentationMasks: [],
      close: () => {},
    } as unknown as PoseLandmarkerResult;
  });
  return result;
}
