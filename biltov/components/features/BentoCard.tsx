"use client";

import { useRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "../Reveal";
import { cn } from "@/lib/utils";

/** Carte Bento avec halo qui suit le curseur. */
export function BentoCard({
  icon: Icon,
  title,
  desc,
  className,
  delay = 0,
  children,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !ref.current) return;
    ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <Reveal delay={delay} className={cn("h-full", className)}>
      <div
        ref={ref}
        onPointerMove={onMove}
        className="card group flex h-full flex-col overflow-hidden p-6 sm:p-7"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(420px circle at var(--mx) var(--my), rgba(29,78,216,0.08), transparent 60%)" }}
          aria-hidden
        />
        <div className="relative flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-blue/30">
            <Icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <h3 className="font-display text-xl font-bold text-white">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{desc}</p>
          </div>
        </div>
        <div className="relative mt-6 flex-1">{children}</div>
      </div>
    </Reveal>
  );
}
