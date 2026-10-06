"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useTr } from "@/lib/app/tr";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-ink/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan disabled:opacity-60";
export const cellClass = "rounded-lg border border-white/10 bg-ink/70 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-cyan disabled:border-transparent disabled:bg-transparent";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | false | null; children: ReactNode; className?: string }) {
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

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean | "xl"; footer?: ReactNode }) {
  const { t } = useTr();
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
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className={cn("card flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-b-none pb-[env(safe-area-inset-bottom)] sm:rounded-3xl sm:pb-0", wide === "xl" ? "max-w-7xl" : wide ? "max-w-5xl" : "max-w-2xl")}
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 sm:px-7">
          <h2 className="font-display text-xl font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={t("Fermer")}>
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
      {tabs.map((tb) => (
        <button
          key={tb.id}
          role="tab"
          aria-selected={value === tb.id}
          onClick={() => onChange(tb.id)}
          className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors", value === tb.id ? "bg-blue text-white" : "text-slate-400 hover:text-white")}
        >
          {tb.label}
          {tb.count !== undefined && <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums">{tb.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, text, action }: { icon: React.ComponentType<{ className?: string }>; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <Icon className="h-8 w-8 text-slate-600" />
      <p className="max-w-md text-sm text-slate-400">{text}</p>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "ok" | "danger"; children: ReactNode }) {
  const styles = { info: "border-blue/30 bg-blue/10 text-sky-200", warn: "border-amber-400/30 bg-amber-400/10 text-amber-200", ok: "border-emerald/30 bg-emerald/10 text-emerald", danger: "border-rose-500/30 bg-rose-500/10 text-rose-200" };
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", styles[tone])}>{children}</div>;
}

/** Page ouverte en lecture seule (droits de l'utilisateur actif) : les actions de création sont masquées. */
export const ReadOnlyContext = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyContext);

export function PageHeader({ title, subtitle, actions: given }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const actions = useReadOnly() ? null : given;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "danger"; onClick?: () => void }) {
  const color = tone === "ok" ? "text-emerald" : tone === "warn" ? "text-amber-300" : tone === "danger" ? "text-rose-300" : "text-white";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={cn("card p-5 text-left", onClick && "transition-colors hover:border-cyan/40")}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={cn("font-display text-2xl font-bold tabular-nums sm:text-3xl", color)}>{value}</p>
      {sub && <p className="text-xs tabular-nums text-slate-500">{sub}</p>}
    </Tag>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cn(inputClass, "pl-9")} />
    </label>
  );
}

export function Badge({ label, style, className }: { label: string; style: string; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", style, className)}>{label}</span>;
}

/** Tableau simple, triable par colonne. */
export type Col<T> = { key: string; label: string; render: (row: T) => ReactNode; sort?: (row: T) => string | number; className?: string };
export function DataTable<T extends { id: string }>({ rows, cols, onRow, sort, onSort, empty }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; sort?: { key: string; dir: "asc" | "desc" }; onSort?: (key: string) => void; empty?: string }) {
  const sorted = (() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.key === sort.key);
    if (!c?.sort) return rows;
    const col = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
    return [...rows].sort((a, b) => {
      const va = c.sort!(a);
      const vb = c.sort!(b);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : col.compare(String(va), String(vb));
      return sort.dir === "asc" ? r : -r;
    });
  })();
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
            {cols.map((c) => (
              <th key={c.key} className={cn("px-4 py-3 font-semibold", c.className)} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                {c.sort && onSort ? (
                  <button onClick={() => onSort(c.key)} className={cn("hover:text-white", sort?.key === c.key && "text-cyan")}>
                    {c.label} {sort?.key === c.key ? (sort.dir === "asc" ? "↑" : "↓") : ""}
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={cn("border-b border-white/5 last:border-0", onRow && "cursor-pointer hover:bg-white/[0.03]")}>
              {cols.map((c) => (
                <td key={c.key} className={cn("px-4 py-3", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
          {!sorted.length && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-10 text-center text-sm text-slate-500">
                {empty ?? "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
