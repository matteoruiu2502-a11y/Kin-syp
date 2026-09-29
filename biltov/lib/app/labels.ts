import type { DocStatus, JobStatus } from "./types";

export const JOB_STATUSES: JobStatus[] = ["draft", "sent", "accepted", "in_progress", "done", "refused"];

export const JOB_STATUS: Record<JobStatus, { label: string; style: string; color: string }> = {
  draft: { label: "Brouillon", style: "bg-slate-500/15 text-slate-300 ring-slate-400/30", color: "#64748b" },
  sent: { label: "Devis envoyé", style: "bg-blue/15 text-sky-300 ring-blue/40", color: "#3b82ff" },
  accepted: { label: "Accepté", style: "bg-emerald/15 text-emerald ring-emerald/40", color: "#10b981" },
  in_progress: { label: "En cours", style: "bg-amber-400/15 text-amber-300 ring-amber-400/40", color: "#fbbf24" },
  done: { label: "Terminé", style: "bg-cyan/15 text-cyan ring-cyan/40", color: "#22d3ee" },
  refused: { label: "Refusé", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40", color: "#f43f5e" },
};

export const DOC_STATUS: Record<DocStatus, { label: string; style: string }> = {
  draft: { label: "Brouillon", style: "bg-slate-500/15 text-slate-300 ring-slate-400/30" },
  sent: { label: "Envoyé", style: "bg-blue/15 text-sky-300 ring-blue/40" },
  accepted: { label: "Signé", style: "bg-emerald/15 text-emerald ring-emerald/40" },
  refused: { label: "Refusé", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
  issued: { label: "À encaisser", style: "bg-amber-400/15 text-amber-300 ring-amber-400/40" },
  paid: { label: "Payée", style: "bg-emerald/15 text-emerald ring-emerald/40" },
  cancelled: { label: "Annulée (avoir)", style: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
};

export const UNITS = ["u", "m²", "m³", "ml", "h", "j", "forfait", "lot", "kg", "L"];
