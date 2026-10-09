"use client";

// Point d'entrée unique du mode 3D : le reste de l'application n'importe que ce fichier.
// Il reste léger (aucun Three.js) : la scène n'est téléchargée qu'à la première ouverture du mode 3D.

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Box, LayoutList, X } from "lucide-react";
import { useTr } from "@/lib/app/tr";
import { cn } from "@/lib/utils";
import { UNSUPPORTED_TEXT, readMode, unsupportedReason, writeMode, type Unsupported } from "./prefs";

export type { ZoneAccess, OpenTarget } from "./zones";

function SceneLoading() {
  return (
    <div className="flex h-full items-center justify-center" aria-label="Chargement">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
    </div>
  );
}

/** Scène du bâtiment (Three.js), chargée à la demande. */
export const Building3D = dynamic(() => import("./Building3D").then((m) => m.Building3D), { ssr: false, loading: SceneLoading });

/** État du mode d'affichage pour l'utilisateur connecté sur l'appareil. */
export function useMode3D(accountId: string, memberId: string | null) {
  const [on, setOnState] = useState(false);
  const [notice, setNotice] = useState<Unsupported | null>(null);
  const [ready, setReady] = useState(false);

  // restauration du choix mémorisé, avec repli automatique si l'appareil ne peut pas afficher la 3D
  useEffect(() => {
    const wanted = readMode(accountId, memberId);
    const reason = wanted ? unsupportedReason() : null;
    if (reason) {
      writeMode(accountId, memberId, false);
      setNotice(reason);
    }
    setOnState(wanted && !reason);
    setReady(true);
  }, [accountId, memberId]);

  // « réduire les animations » activé en cours d'utilisation : retour au mode normal
  useEffect(() => {
    if (!on) return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => mq.matches && fallback("motion");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  /** Change de mode ; renvoie false si la 3D est impossible sur cet appareil (un message s'affiche). */
  const setOn = useCallback(
    (v: boolean) => {
      const reason = v ? unsupportedReason() : null;
      if (reason) {
        setNotice(reason);
        return false;
      }
      writeMode(accountId, memberId, v);
      setOnState(v);
      setNotice(null);
      return true;
    },
    [accountId, memberId],
  );

  /** Appelé par la scène si l'affichage s'avère impossible ou trop lent. */
  const fallback = useCallback(
    (reason: Unsupported) => {
      writeMode(accountId, memberId, false);
      setOnState(false);
      setNotice(reason);
    },
    [accountId, memberId],
  );

  return { on, ready, setOn, fallback, notice, clearNotice: useCallback(() => setNotice(null), []) };
}

/** Interrupteur « Normal | 3D » de l'en-tête. */
export function Mode3DToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTr();
  return (
    <div role="group" aria-label={t("Mode d'affichage")} className="flex shrink-0 rounded-lg border border-white/10 p-0.5 text-xs font-semibold">
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => v !== on && onChange(v)}
          aria-pressed={on === v}
          title={v ? t("Mode 3D : naviguer dans le bâtiment de l'entreprise") : t("Mode normal")}
          className={cn("flex items-center gap-1 rounded-md px-2 py-1", on === v ? "bg-white/10 text-white" : "text-slate-500 hover:text-white")}
        >
          {v ? <Box className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
          <span className={v ? "" : "hidden 2xl:inline"}>{v ? "3D" : t("Normal")}</span>
        </button>
      ))}
    </div>
  );
}

/** Bouton de retour à la scène, affiché au-dessus d'un module ouvert depuis le bâtiment. */
export function BackToBuilding({ onClick }: { onClick: () => void }) {
  const { t } = useTr();
  return (
    <button type="button" onClick={onClick} className="btn-ghost mb-5 !px-3 !py-2 text-sm">
      <ArrowLeft className="h-4 w-4" /> {t("Bâtiment")}
    </button>
  );
}

/** Message discret quand la 3D a dû être désactivée. */
export function Mode3DNotice({ reason, onClose }: { reason: Unsupported; onClose: () => void }) {
  const { t } = useTr();
  useEffect(() => {
    const id = setTimeout(onClose, 8000);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div role="status" className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-ink p-4 text-sm text-slate-200 shadow-2xl md:bottom-6">
      <Box className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p className="flex-1">{t(UNSUPPORTED_TEXT[reason])}</p>
      <button type="button" onClick={onClose} className="text-slate-500 hover:text-white" aria-label={t("Fermer")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
