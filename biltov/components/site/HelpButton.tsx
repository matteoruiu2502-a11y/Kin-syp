"use client";

import { MessageCircleQuestion } from "lucide-react";
import { openHelp } from "@/lib/help";
import { cn } from "@/lib/utils";

/** Ouvre le chat d'aide (avec une question préremplie, éventuellement). */
export function HelpButton({ question, className, children }: { question?: string; className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => openHelp(question)} className={cn("btn-ghost", className)}>
      <MessageCircleQuestion className="h-4 w-4" /> {children ?? "Poser une question"}
    </button>
  );
}
