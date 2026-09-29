"use client";

import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-ink/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan disabled:opacity-60";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | false; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-400">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className={cn("card flex max-h-[94vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-3xl", wide ? "max-w-5xl" : "max-w-2xl")}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 sm:px-7">
          <h2 className="font-display text-xl font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-white/5 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}

export function SubTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.02] p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors", value === t.id ? "bg-gradient-to-r from-blue/40 to-emerald/30 text-white" : "text-slate-400 hover:text-white")}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, text, action }: { icon: React.ComponentType<{ className?: string }>; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <Icon className="h-8 w-8 text-slate-600" />
      <p className="max-w-sm text-sm text-slate-400">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: ReactNode }) {
  const styles = { info: "border-blue/30 bg-blue/10 text-sky-200", warn: "border-amber-400/30 bg-amber-400/10 text-amber-200", ok: "border-emerald/30 bg-emerald/10 text-emerald" };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[tone])}>{children}</div>;
}
