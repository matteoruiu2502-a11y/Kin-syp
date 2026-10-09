// Caméra isométrique, contrôles limités (pas de vue absurde) et détection des pièces sous le pointeur.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const AZIMUTH = Math.PI / 4; // vue de face, trois-quarts droite
const POLAR = 0.96; // ≈ isométrique
const DISTANCE = 60;
export const ZOOM = { min: 0.8, max: 3, open: 1.9 };

export function createCamera() {
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  cam.position.setFromSphericalCoords(DISTANCE, POLAR, AZIMUTH);
  cam.lookAt(0, 0, 0);
  return cam;
}

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
const REF = createCameraAt();
function createCameraAt() {
  const c = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  c.position.setFromSphericalCoords(DISTANCE, POLAR, AZIMUTH);
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}

/**
 * Cadrage selon la taille de l'écran : la boîte englobante de la scène (bâtiment, enseigne, parking),
 * vue depuis la position de départ, remplit l'écran avec une petite marge.
 */
export function fitCamera(cam: THREE.OrthographicCamera, width: number, height: number, b: Bounds, top = 6.4) {
  const v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [b.minX, b.maxX]) for (const y of [0, top]) for (const z of [b.minZ, b.maxZ]) {
    v.set(x, y, z).applyMatrix4(REF.matrixWorldInverse);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
  }
  const aspect = width / Math.max(1, height);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let hw = ((x1 - x0) / 2) * 1.04;
  let hh = ((y1 - y0) / 2) * 1.08;
  if (hw / hh < aspect) hw = hh * aspect;
  else hh = hw / aspect;
  cam.left = cx - hw;
  cam.right = cx + hw;
  cam.top = cy + hh;
  cam.bottom = cy - hh;
  cam.updateProjectionMatrix();
}

/** Vue de départ : tout l'ensemble à l'écran ; en portrait (téléphone), zoom sur le bâtiment. */
export const startView = (width: number, height: number, buildingX: number) => (width / Math.max(1, height) < 0.9 ? { zoom: 1.3, x: buildingX * 0.6 } : { zoom: 1, x: 0 });

/**
 * Contrôles : glisser = déplacer (souris gauche / un doigt), rotation limitée (clic droit / deux doigts),
 * molette ou pincement = zoom plafonné. La cible reste au-dessus du terrain.
 */
export function createControls(cam: THREE.OrthographicCamera, dom: HTMLElement, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const c = new OrbitControls(cam, dom);
  c.enableDamping = true;
  c.dampingFactor = 0.12;
  c.screenSpacePanning = false;
  c.minZoom = ZOOM.min;
  c.maxZoom = ZOOM.max;
  c.minAzimuthAngle = AZIMUTH - 0.6;
  c.maxAzimuthAngle = AZIMUTH + 0.6;
  c.minPolarAngle = 0.6;
  c.maxPolarAngle = 1.2;
  c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  c.zoomToCursor = true;
  c.addEventListener("change", () => {
    const t = c.target;
    const x = THREE.MathUtils.clamp(t.x, bounds.minX, bounds.maxX);
    const z = THREE.MathUtils.clamp(t.z, bounds.minZ, bounds.maxZ);
    if (x !== t.x || z !== t.z || t.y !== 0) {
      const d = new THREE.Vector3(x - t.x, -t.y, z - t.z);
      t.add(d);
      cam.position.add(d);
    }
  });
  return c;
}

/** Remet la caméra dans sa position de départ. */
export function resetView(cam: THREE.OrthographicCamera, c: OrbitControls, view = { zoom: 1, x: 0 }) {
  c.target.set(view.x, 0, 0);
  cam.position.setFromSphericalCoords(DISTANCE, POLAR, AZIMUTH).add(c.target);
  cam.zoom = view.zoom;
  cam.updateProjectionMatrix();
  c.update();
}

/** Pièce sous le pointeur (coordonnées normalisées -1…1), ou null. */
export function pickZone(ray: THREE.Raycaster, cam: THREE.Camera, ndc: THREE.Vector2, hits: THREE.Object3D[]): string | null {
  ray.setFromCamera(ndc, cam);
  const first = ray.intersectObjects(hits, false)[0];
  return (first?.object.userData.zone as string | undefined) ?? null;
}

export type Tween = { from: THREE.Vector3; to: THREE.Vector3; fromZoom: number; toZoom: number; start: number; ms: number; done: () => void };

/** Animation de caméra vers une pièce (500 ms maximum), puis ouverture du module. */
export function startTween(cam: THREE.OrthographicCamera, c: OrbitControls, to: THREE.Vector3, ms: number, done: () => void): Tween {
  return { from: c.target.clone(), to: to.clone().setY(0), fromZoom: cam.zoom, toZoom: Math.max(cam.zoom, ZOOM.open), start: performance.now(), ms, done };
}

/** Avance l'animation ; renvoie false quand elle est terminée. */
export function stepTween(tw: Tween, cam: THREE.OrthographicCamera, c: OrbitControls, now: number) {
  const k = Math.min(1, (now - tw.start) / tw.ms);
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // accélération puis freinage
  const target = tw.from.clone().lerp(tw.to, e);
  const offset = cam.position.clone().sub(c.target);
  c.target.copy(target);
  cam.position.copy(target).add(offset);
  cam.zoom = tw.fromZoom + (tw.toZoom - tw.fromZoom) * e;
  cam.updateProjectionMatrix();
  if (k >= 1) tw.done();
  return k < 1;
}
