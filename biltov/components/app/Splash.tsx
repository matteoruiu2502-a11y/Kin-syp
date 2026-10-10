"use client";

import { useEffect, useState } from "react";
import { BiltovLogo } from "../BiltovLogo";

const SEEN_KEY = "biltov.splash";
/** Durée de l'animation du logo (voir .bl-anim dans globals.css) */
const ANIMATION_MS = 1300;
const FADE_MS = 350;

/**
 * Écran d'ouverture : logo animé une fois par ouverture de l'application (onglet ou appli installée).
 * Il recouvre le chargement des données au lieu de le retarder : il s'efface dès que l'animation est
 * finie ET que l'espace est prêt. Un toucher le passe ; « réduire les animations » le supprime.
 */
export function Splash({ ready }: { ready: boolean }) {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setPhase("gone");
    const id = setTimeout(() => setPlayed(true), ANIMATION_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (phase === "show" && played && ready) setPhase("fade");
    if (phase !== "fade") return;
    const id = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(id);
  }, [phase, played, ready]);

  if (phase === "gone") return null;
  return (
    <div
      aria-hidden
      onClick={() => setPhase("fade")}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)] transition-opacity ease-out"
      style={{ opacity: phase === "fade" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="relative flex items-center justify-center">
        <div className="splash-halo absolute h-72 w-72 rounded-full" />
        <BiltovLogo size={72} animated className="relative" />
      </div>
    </div>
  );
}
