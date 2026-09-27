/** Point 2D en pixels écran (repère déjà converti depuis l'image caméra). */
export interface Point2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Repère détecté, projeté dans le repère de la vue. */
export interface ScreenLandmark extends Point2 {
  /** Probabilité [0-1] que le repère soit visible (non occulté). */
  visibility: number;
}

/**
 * Une image analysée : 33 repères en coordonnées écran, plus les
 * coordonnées "monde" 3D (mètres, centrées sur le bassin) quand disponibles.
 */
export interface PoseFrame {
  timestampMs: number;
  landmarks: ScreenLandmark[];
  worldLandmarks?: Vec3[];
}
