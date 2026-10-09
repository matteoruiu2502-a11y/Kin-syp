"use client";

// Vue 3D du bâtiment (étape 1 : écran vide, la scène arrive à l'étape suivante).

import { LayoutList } from "lucide-react";
import { useTr } from "@/lib/app/tr";
import type { PageAccess } from "./zones";
import type { Unsupported } from "./prefs";

export type Building3DProps = {
  access: (page: string) => PageAccess;
  onOpen: (target: string) => void;
  onExit: () => void;
  onFallback: (reason: Unsupported) => void;
};

export function Building3D({ onExit }: Building3DProps) {
  const { t } = useTr();
  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <button type="button" onClick={onExit} className="btn-ghost absolute right-3 top-3 z-10 !px-3 !py-2 text-sm">
        <LayoutList className="h-4 w-4" /> {t("Retour au mode normal")}
      </button>
    </div>
  );
}
