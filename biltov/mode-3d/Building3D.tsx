"use client";

// Vue 3D du bâtiment : rendu Three.js + étiquettes HTML des pièces (accessibles au clavier et aux lecteurs d'écran).
// Aucune logique métier : un clic sur une pièce ouvre la page existante via `onOpen` (même adresse que le menu).

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LayoutList, Lock, Minus, Plus, RotateCcw, Sparkles } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { todayIso } from "@/lib/app/defaults";
import { cn } from "@/lib/utils";
import { sceneFacts, type Badge, type BadgeCtx, type Tone } from "./badges";
import { ZONES, resolveZone, type PageAccess, type ZoneAccess } from "./zones";
import { readAmbiance, writeAmbiance, type Unsupported } from "./prefs";
import { isDarkTheme, readPalette } from "./theme";
import { SHARED, buildScene, buildingCenterX, type BuiltScene } from "./scene";
import { createAmbiance, type Ambiance } from "./ambiance";
import { ZOOM, createCamera, createControls, fitCamera, pickZone, resetView, startTween, startView, stepTween, type Tween } from "./interactions";

export type Building3DProps = {
  access: (page: string) => PageAccess;
  onOpen: (target: string) => void;
  onExit: () => void;
  onFallback: (reason: Unsupported) => void;
};

const MAX_VANS = 8;
const DEFAULT_BOUNDS = { minX: -11.5, maxX: 11.5, minZ: -5.5, maxZ: 5.5 };
const OPEN_MS = 450;
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Couleurs des pastilles (texte foncé sur orange et vert pour un contraste suffisant). */
const TONE_STYLE: Record<Tone, { background: string; color: string }> = {
  danger: { background: "var(--danger)", color: "#ffffff" },
  warning: { background: "var(--warning)", color: "#0b1220" },
  ok: { background: "var(--success)", color: "#0b1220" },
  neutral: { background: "var(--brand)", color: "#ffffff" },
};

/** Logo de l'enseigne, dessiné sur un canevas (SVG du projet, variante selon le fond). */
async function loadLogo(dark: boolean, background: string) {
  const res = await fetch(`${base}/brand/${dark ? "biltov-logo.svg" : "biltov-logo-fond-clair.svg"}`);
  // largeur/hauteur explicites : certains navigateurs (Firefox) refusent de dessiner un SVG sans taille
  const svg = (await res.text()).replace("<svg ", '<svg width="936" height="360" ');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 1260;
    c.height = 300;
    const g = c.getContext("2d")!;
    g.fillStyle = background;
    g.fillRect(0, 0, c.width, c.height);
    const h = 240;
    const w = (h * 936) / 360;
    g.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type ZoneView = { id: string; name: string; short: string; description: string; access: ZoneAccess; target: string | null; badge: Badge | null };

export function Building3D({ access, onOpen, onExit, onFallback }: Building3DProps) {
  const { t } = useTr();
  const { data, can, actor } = useAppData();
  const [dark, setDark] = useState(isDarkTheme);
  const [ambiance, setAmbiance] = useState(readAmbiance);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [restored, setRestored] = useState(0);
  const [touch, setTouch] = useState(false);
  // la scène occupe la hauteur visible restante (sous l'en-tête et les bandeaux, au-dessus de la barre mobile)
  const [height, setHeight] = useState(520);
  useEffect(() => {
    const measure = () => {
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottomBar = window.innerWidth < 768 ? 96 : 32;
      setHeight(Math.max(380, window.innerHeight - top - bottomBar));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // ── données : état de chaque pièce (droits du mode normal) et badges ──
  const today = todayIso();
  const ctx: BadgeCtx = { data, can: (m) => can(m), me: actor, today, t };
  const zones: ZoneView[] = ZONES.map((z) => {
    const r = resolveZone(z, access);
    return { id: z.id, name: t(z.name), short: t(z.short ?? z.name), description: t(z.description), ...r, badge: r.access === "ok" && z.badge ? z.badge(ctx) : null };
  });
  const facts = sceneFacts(ctx);
  // la scène n'est reconstruite que si ce qu'elle affiche change
  const sceneKey = JSON.stringify({ a: zones.map((z) => z.access), facts, dark, restored });

  // ── Three.js : création unique, libération complète au démontage ──
  const box = useRef<HTMLDivElement>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    cam: THREE.OrthographicCamera;
    controls: ReturnType<typeof createControls>;
    sun: THREE.DirectionalLight;
    fill: THREE.HemisphereLight;
    built: BuiltScene | null;
    amb: Ambiance | null;
    logos: Partial<Record<"dark" | "light", THREE.Texture>>;
    dirty: boolean;
    tween: Tween | null;
    size: { w: number; h: number };
    quality: "high" | "low";
    startProbe: () => void;
  } | null>(null);
  const cb = useRef({ onOpen, onFallback });
  cb.current = { onOpen, onFallback };
  const [logoReady, setLogoReady] = useState(0);
  const probed = useRef<{ high?: boolean; low?: boolean }>({});

  useEffect(() => {
    const el = box.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      cb.current.onFallback("webgl");
      return;
    }
    const coarse = matchMedia("(pointer: coarse)").matches;
    setTouch(coarse);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // bâtiment statique : ombres calculées à chaque reconstruction seulement
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const fill = new THREE.HemisphereLight("#ffffff", "#94a3b8", 1.4);
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(-10, 20, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(fill, sun, sun.target);

    const cam = createCamera();
    const controls = createControls(cam, renderer.domElement, { minX: -9, maxX: 9, minZ: -6, maxZ: 6 });
    const st: NonNullable<typeof three.current> = { renderer, scene, cam, controls, sun, fill, built: null, amb: null, logos: {}, dirty: true, tween: null, size: { w: 1, h: 1 }, quality: "high", startProbe: () => {} };
    three.current = st;
    controls.addEventListener("change", () => (st.dirty = true));

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      st.size = { w, h };
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      fitCamera(cam, w, h, st.built?.bounds ?? DEFAULT_BOUNDS);
      st.dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // étiquettes HTML placées sur la projection de chaque pièce
    const v = new THREE.Vector3();
    const placeLabels = () => {
      for (const z of st.built?.zones ?? []) {
        const node = labels.current.get(z.config.id);
        if (!node) continue;
        v.copy(z.anchor).project(cam);
        const x = ((v.x + 1) / 2) * st.size.w;
        const y = ((1 - v.y) / 2) * st.size.h;
        node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        node.style.visibility = x < -40 || y < -20 || x > st.size.w + 40 || y > st.size.h + 60 ? "hidden" : "visible";
      }
    };

    // boucle de rendu : ne dessine que si quelque chose a changé (ou si l'ambiance est animée)
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    const started = performance.now();
    const intro = 700;
    const start = startView(el.clientWidth, el.clientHeight, buildingCenterX(ZONES));
    resetView(cam, controls, start);
    // mesure de fluidité : 1,5 s de rendu continu, une fois la scène construite et le chargement terminé
    const deltas: number[] = [];
    let probeStart = Infinity;
    let probeEnd = Infinity;
    st.startProbe = () => {
      probeStart = performance.now() + 400;
      probeEnd = probeStart + 1500;
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (st.tween && !stepTween(st.tween, cam, controls, now)) st.tween = null;
      if (st.tween) st.dirty = true;
      if (controls.update()) st.dirty = true;
      // entrée en douceur (sert aussi à mesurer la fluidité de l'appareil)
      if (now - started < intro) {
        const k = (now - started) / intro;
        cam.zoom = start.zoom * (0.85 + 0.15 * (1 - Math.pow(1 - k, 3)));
        cam.updateProjectionMatrix();
        st.dirty = true;
      }
      const animate = !!st.amb && now - lastDraw > (coarse ? 33 : 16);
      if (st.amb && animate) {
        st.amb.update(dt);
        st.dirty = true;
      }
      const probing = now < probeEnd;
      if (!st.dirty && !probing) {
        if (deltas.length) checkSpeed();
        return;
      }
      lastDraw = now;
      st.dirty = false;
      renderer.render(scene, cam);
      placeLabels();
      if (probing && now > probeStart) deltas.push(dt * 1000);
      else if (!probing && deltas.length) checkSpeed();
    };
    // appareil trop lent : d'abord qualité réduite, puis repli sur le mode normal
    const checkSpeed = () => {
      const sorted = deltas.splice(0).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      // moins de 20 images/s : qualité réduite (sans ombres, résolution 1) ; encore sous 10 images/s : mode normal
      if (st.quality === "high" && median > 50) {
        st.quality = "low";
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        resize();
        setAmbiance(false);
        setRestored((n) => n + 1); // reconstruction : les matériaux sont recompilés sans ombres
      } else if (st.quality === "low" && median > 100) cb.current.onFallback("slow");
    };
    raf = requestAnimationFrame(frame);

    // onglet masqué : rendu en pause
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        st.dirty = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // contexte WebGL perdu (mémoire du téléphone) : reconstruction au retour
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => setRestored((n) => n + 1);
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);

    // thème jour / nuit du site
    const mo = new MutationObserver(() => setDark(isDarkTheme()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      controls.dispose();
      st.built?.dispose();
      st.amb?.dispose();
      Object.values(st.logos).forEach((x) => x?.dispose());
      Object.values(SHARED).forEach((g) => g.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      three.current = null;
    };
  }, []);

  // logo de l'enseigne (variante jour / nuit), chargé une fois par thème
  useEffect(() => {
    const st = three.current;
    const k = dark ? "dark" : "light";
    if (!st || st.logos[k]) return;
    let alive = true;
    loadLogo(dark, readPalette().sign)
      .then((tex) => {
        if (!alive || !three.current) return tex.dispose();
        three.current.logos[k] = tex;
        setLogoReady((n) => n + 1);
      })
      .catch(() => {}); // sans logo, l'enseigne reste unie
    return () => {
      alive = false;
    };
  }, [dark]);

  // (re)construction de la scène quand le thème, les droits ou les données affichées changent
  useEffect(() => {
    const st = three.current;
    if (!st) return;
    const pal = readPalette();
    if (st.built) {
      st.scene.remove(st.built.root);
      st.built.dispose();
    }
    const access = Object.fromEntries(zones.map((z) => [z.id, z.access]));
    st.built = buildScene(ZONES, access, facts, pal, st.logos[pal.dark ? "dark" : "light"] ?? null);
    st.scene.add(st.built.root);
    fitCamera(st.cam, st.size.w, st.size.h, st.built.bounds);
    st.scene.background = new THREE.Color(pal.background);
    st.fill.color.set(pal.dark ? "#93a4c3" : "#ffffff");
    st.fill.groundColor.set(pal.dark ? "#0b1220" : "#cbd5e1");
    st.fill.intensity = pal.dark ? 1.6 : 1.7;
    st.sun.intensity = pal.dark ? 1.5 : 2.1;
    st.renderer.shadowMap.needsUpdate = true;
    st.dirty = true;
    // première construction (puis après passage en qualité réduite) : mesure de fluidité
    if (!probed.current[st.quality]) {
      probed.current[st.quality] = true;
      st.startProbe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, logoReady]);

  // ambiance (nuages, fumée) : désactivable
  useEffect(() => {
    const st = three.current;
    if (!st?.built) return;
    st.amb?.dispose();
    if (st.amb) st.scene.remove(st.amb.group);
    st.amb = null;
    if (ambiance) {
      st.amb = createAmbiance(readPalette(), st.built.chimney, st.built.bounds);
      st.scene.add(st.amb.group);
    }
    st.dirty = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiance, sceneKey]);

  // surbrillance de la pièce survolée, sélectionnée ou ayant le focus clavier
  const active = hovered ?? focused ?? selected;
  useEffect(() => {
    const st = three.current;
    if (!st?.built) return;
    for (const z of st.built.zones) (z.glow.material as THREE.MeshBasicMaterial).opacity = z.config.id === active && z.access === "ok" ? (dark ? 0.32 : 0.2) : 0;
    st.dirty = true;
  }, [active, sceneKey, dark]);

  // ── ouverture d'une pièce : petit déplacement de caméra puis le vrai module ──
  const open = (id: string) => {
    const z = zones.find((x) => x.id === id);
    const st = three.current;
    if (!z || z.access !== "ok" || !z.target || !st || st.tween) return;
    const target = z.target;
    const center = st.built?.zones.find((x) => x.config.id === id)?.center;
    if (!center) return cb.current.onOpen(target);
    st.controls.enabled = false;
    st.tween = startTween(st.cam, st.controls, center, OPEN_MS, () => cb.current.onOpen(target));
  };

  // pointeur sur le canevas : survol (souris), appui (tactile), sans confondre avec un glissement
  const down = useRef<{ x: number; y: number } | null>(null);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hit = (e: React.PointerEvent) => {
    const st = three.current;
    if (!st?.built) return null;
    const r = st.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    return pickZone(ray, st.cam, ndc, st.built.zones.map((z) => z.hit));
  };

  const zoomBy = (k: number) => {
    const st = three.current;
    if (!st) return;
    st.cam.zoom = THREE.MathUtils.clamp(st.cam.zoom * k, ZOOM.min, ZOOM.max);
    st.cam.updateProjectionMatrix();
    st.dirty = true;
  };

  const tip = zones.find((z) => z.id === active);
  const stateText = (z: ZoneView) =>
    z.access === "locked" ? t("Accès non autorisé pour votre rôle") : z.access === "soon" ? t("Bientôt disponible") : z.access === "off" ? t("Module désactivé dans les paramètres") : null;

  return (
    <div
      ref={box}
      role="region"
      aria-label={t("Bâtiment Biltov en 3D")}
      className="relative touch-none select-none overflow-hidden rounded-2xl border border-white/10"
      style={{ background: "var(--bg)", height }}
      onPointerDown={(e) => {
        if (e.target !== three.current?.renderer.domElement) return;
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || e.buttons || e.target !== three.current?.renderer.domElement) return;
        const id = hit(e);
        if (id !== hovered) setHovered(id);
        three.current!.renderer.domElement.style.cursor = id && zones.find((z) => z.id === id)?.access === "ok" ? "pointer" : "";
      }}
      onPointerLeave={() => setHovered(null)}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
        const id = hit(e);
        if (e.pointerType === "mouse") return id ? open(id) : undefined;
        // tactile : premier appui = sélection (info-bulle), second appui sur la même pièce = ouverture
        if (id && id === selected) open(id);
        else setSelected(id);
      }}
    >
      {/* étiquettes des pièces : vrais boutons, atteignables avec Tab et activables avec Entrée */}
      <nav aria-label={t("Pièces du bâtiment")} className="pointer-events-none absolute inset-0">
        {zones.map((z) => {
          const isActive = active === z.id;
          const vans = z.id === "parking" && z.access === "ok" ? facts.vans : 0;
          const extra = vans > MAX_VANS ? vans - MAX_VANS : 0;
          const state = stateText(z);
          return (
            <div
              key={z.id}
              ref={(n) => {
                if (n) labels.current.set(z.id, n);
                else labels.current.delete(z.id);
              }}
              className={cn("absolute left-0 top-0 flex flex-col items-center", isActive ? "z-20" : "z-10")}
              style={{ visibility: "hidden" }}
            >
              {isActive && tip && (
                <div role="tooltip" id={`zone-tip-${z.id}`} className="pointer-events-auto mb-2 w-60 rounded-xl border p-3 text-left text-xs shadow-xl" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
                  <p className="text-sm font-semibold">{z.name}</p>
                  <p className="mt-0.5" style={{ color: "var(--muted)" }}>{z.description}</p>
                  {z.badge && <p className="mt-1.5 font-medium">{z.badge.text}</p>}
                  {extra > 0 && <p className="mt-1" style={{ color: "var(--muted)" }}>{t("{n} camionnettes de plus non affichées", { n: extra })}</p>}
                  {state && <p className="mt-1.5 font-medium" style={{ color: "var(--muted)" }}>{state}</p>}
                  {touch && z.access === "ok" && (
                    <button type="button" onClick={() => open(z.id)} className="btn-primary mt-2 w-full !py-1.5 text-xs">
                      {t("Ouvrir")}
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                aria-disabled={z.access !== "ok"}
                aria-describedby={isActive ? `zone-tip-${z.id}` : undefined}
                aria-label={[z.name, z.description, z.badge?.text, state, z.access === "ok" ? t("Ouvrir") : null].filter(Boolean).join(". ")}
                onClick={() => open(z.id)}
                onMouseEnter={() => setHovered(z.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setFocused(z.id)}
                onBlur={() => setFocused(null)}
                className={cn(
                  "pointer-events-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold sm:px-3 sm:py-1.5 sm:text-xs shadow-lg outline-none transition-transform focus-visible:ring-2 focus-visible:ring-offset-2",
                  z.access === "ok" ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-75",
                )}
                style={{ background: "var(--card)", borderColor: isActive && z.access === "ok" ? "var(--brand)" : "var(--border)", color: "var(--text)", ["--tw-ring-color" as string]: "var(--brand)", ["--tw-ring-offset-color" as string]: "var(--bg)" }}
              >
                {z.access === "locked" && <Lock className="h-3 w-3" aria-hidden />}
                <span className="sm:hidden">{z.short}</span>
                <span className="hidden sm:inline">{z.name}</span>
                {z.access === "soon" && <span style={{ color: "var(--muted)" }}>· {t("Bientôt disponible")}</span>}
                {z.badge && (
                  <span className="min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums" style={TONE_STYLE[z.badge.tone]} aria-hidden>
                    {z.badge.count}
                  </span>
                )}
                {extra > 0 && (
                  <span className="rounded-full border px-1.5 text-[11px] font-bold tabular-nums" style={{ borderColor: "var(--border)", color: "var(--muted)" }} aria-hidden>
                    +{extra}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* message d'accueil d'un compte encore vide */}
      {facts.empty && (
        <div className="pointer-events-none absolute left-3 top-3 z-30 max-w-xs rounded-xl border p-3 text-xs shadow-lg sm:max-w-sm sm:text-sm" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
          <p className="font-semibold">{t("Bienvenue dans votre bâtiment Biltov")}</p>
          <p className="mt-1" style={{ color: "var(--muted)" }}>
            {t("Chaque pièce ouvre un module de l'application. Les compteurs se rempliront avec vos chantiers, devis et pointages.")}
          </p>
        </div>
      )}

      {/* commandes : retour au mode normal (toujours visible), ambiance, zoom, vue de départ */}
      <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
        <button type="button" onClick={onExit} className="btn-ghost !px-3 !py-1.5 text-xs shadow-lg sm:!py-2 sm:text-sm" style={{ background: "var(--card)" }}>
          <LayoutList className="h-4 w-4" /> {t("Retour au mode normal")}
        </button>
        <div className="flex gap-1 rounded-xl border p-1 shadow-lg" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <IconButton label={t("Zoom avant")} onClick={() => zoomBy(1.25)}>
            <Plus className="h-4 w-4" />
          </IconButton>
          <IconButton label={t("Zoom arrière")} onClick={() => zoomBy(0.8)}>
            <Minus className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={t("Vue de départ")}
            onClick={() => {
              const st = three.current;
              if (!st) return;
              resetView(st.cam, st.controls, startView(st.size.w, st.size.h, st.built?.buildingX ?? 0));
              st.dirty = true;
            }}
          >
            <RotateCcw className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={ambiance ? t("Couper l'ambiance (nuages, fumée)") : t("Activer l'ambiance (nuages, fumée)")}
            pressed={ambiance}
            onClick={() => {
              writeAmbiance(!ambiance);
              setAmbiance(!ambiance);
            }}
          >
            <Sparkles className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-2 left-3 z-30 max-w-[70%] text-[11px] sm:max-w-none" style={{ color: "var(--muted)" }}>
        {touch ? t("Un doigt pour déplacer · deux doigts pour zoomer et pivoter · appuyez sur une pièce") : t("Glisser pour déplacer · clic droit pour pivoter · molette pour zoomer · Tab pour parcourir les pièces")}
      </p>
    </div>
  );
}

function IconButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn("flex h-8 w-8 items-center justify-center rounded-lg outline-none focus-visible:ring-2", pressed === false ? "opacity-50" : "")}
      style={{ color: "var(--text)", ["--tw-ring-color" as string]: "var(--brand)" }}
    >
      {children}
    </button>
  );
}
