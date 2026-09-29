"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUSES, newId, today, type Job } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const inputClass = "w-full rounded-xl border border-white/10 bg-ink/70 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-colors focus:border-cyan";

export function JobForm({ job, onClose, onSave }: { job: Job | null; onClose: () => void; onSave: (job: Job) => void }) {
  const { t } = useI18n();
  const d = t.dashboard;
  const f = d.fields;
  const [draft, setDraft] = useState<Job>(
    job ?? { id: newId(), name: "", client: "", city: "", trade: "plombier", amount: 0, status: "draft", date: today(), notes: "" },
  );
  const [touched, setTouched] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Job>(key: K, value: Job[K]) => setDraft((x) => ({ ...x, [key]: value }));
  const invalid = { name: !draft.name.trim(), client: !draft.client.trim() };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid.name || invalid.client) return;
    onSave({ ...draft, name: draft.name.trim(), client: draft.client.trim(), city: draft.city.trim(), amount: Math.max(0, draft.amount || 0) });
  };

  const field = (label: string, input: React.ReactNode, error?: boolean, className?: string) => (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {input}
      {error && <span className="mt-1 block text-xs text-rose-400">{d.form.required}</span>}
    </label>
  );

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-form-title"
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="card glow-border max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-6 sm:rounded-3xl sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="job-form-title" className="font-display text-2xl font-bold text-white">
            {job ? d.form.editTitle : d.form.newTitle}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={d.form.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {field(`${f.name} *`, <input ref={first} value={draft.name} onChange={(e) => set("name", e.target.value)} className={cn(inputClass, touched && invalid.name && "border-rose-500")} />, touched && invalid.name, "sm:col-span-2")}
          {field(`${f.client} *`, <input value={draft.client} onChange={(e) => set("client", e.target.value)} className={cn(inputClass, touched && invalid.client && "border-rose-500")} />, touched && invalid.client)}
          {field(f.city, <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />)}
          {field(
            f.trade,
            <select value={draft.trade} onChange={(e) => set("trade", e.target.value as Job["trade"])} className={inputClass}>
              {t.trades.list.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>,
          )}
          {field(f.amount, <input type="number" min={0} step="0.01" inputMode="decimal" value={Number.isFinite(draft.amount) ? draft.amount : ""} onChange={(e) => set("amount", e.target.valueAsNumber)} className={inputClass} />)}
          {field(
            f.status,
            <select value={draft.status} onChange={(e) => set("status", e.target.value as Job["status"])} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {d.statuses[s]}
                </option>
              ))}
            </select>,
          )}
          {field(f.date, <input type="date" value={draft.date} onChange={(e) => set("date", e.target.value || today())} className={inputClass} />)}
          {field(f.notes, <textarea rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={cn(inputClass, "resize-none")} />, false, "sm:col-span-2")}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            {d.form.cancel}
          </button>
          <button type="submit" className="btn-primary text-sm">
            {d.form.save}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
