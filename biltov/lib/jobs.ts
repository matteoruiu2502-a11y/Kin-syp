"use client";

import { useCallback, useEffect, useState } from "react";
import type { TradeId } from "./content/fr";

export const STATUSES = ["draft", "sent", "accepted", "in_progress", "done", "refused"] as const;
export type JobStatus = (typeof STATUSES)[number];

export type Job = {
  id: string;
  name: string;
  client: string;
  city: string;
  trade: TradeId;
  amount: number;
  status: JobStatus;
  date: string; // AAAA-MM-JJ
  notes: string;
};

export const STATUS_STYLE: Record<JobStatus, string> = {
  draft: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  sent: "bg-blue/15 text-sky-300 ring-blue/40",
  accepted: "bg-emerald/15 text-emerald ring-emerald/40",
  in_progress: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  done: "bg-cyan/15 text-cyan ring-cyan/40",
  refused: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  draft: "#64748b",
  sent: "#3b82ff",
  accepted: "#10b981",
  in_progress: "#fbbf24",
  done: "#22d3ee",
  refused: "#f43f5e",
};

const STORAGE_KEY = "biltov.jobs.v1";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const SAMPLE_JOBS: Omit<Job, "id">[] = [
  { name: "Salle de bain Durand", client: "Paul Durand", city: "Lyon", trade: "plombier", amount: 6840, status: "accepted", date: daysAgo(3), notes: "Receveur extra-plat, faïence 30×60" },
  { name: "Tableau électrique Girard", client: "Marc Girard", city: "Villeurbanne", trade: "electricien", amount: 1340, status: "sent", date: daysAgo(1), notes: "" },
  { name: "Chambre Moreau", client: "Famille Moreau", city: "Bron", trade: "peintre", amount: 1248, status: "in_progress", date: daysAgo(9), notes: "Velours blanc, plafond mat" },
  { name: "Terrasse béton Petit", client: "Julien Petit", city: "Caluire", trade: "macon", amount: 1832, status: "sent", date: daysAgo(5), notes: "Dalle 25 m², ép. 12 cm" },
  { name: "Fenêtres PVC Roux", client: "Claire Roux", city: "Écully", trade: "menuisier", amount: 2004, status: "done", date: daysAgo(21), notes: "3 fenêtres 120×135" },
  { name: "Cuisine SCI Horizon", client: "SCI Horizon", city: "Lyon", trade: "plombier", amount: 3150, status: "draft", date: daysAgo(0), notes: "" },
  { name: "Ravalement Bernard", client: "Alain Bernard", city: "Tassin", trade: "peintre", amount: 8900, status: "refused", date: daysAgo(30), notes: "Trop cher selon le client" },
];

const withIds = (jobs: Omit<Job, "id">[]): Job[] => jobs.map((j) => ({ ...j, id: newId() }));

/** Chantiers de l'utilisateur, enregistrés dans le navigateur (localStorage). */
export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let initial: Job[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) initial = JSON.parse(raw) as Job[];
    } catch {}
    setJobs(Array.isArray(initial) ? initial : withIds(SAMPLE_JOBS));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {}
  }, [jobs, ready]);

  const save = useCallback((job: Job) => {
    setJobs((list) => (list.some((j) => j.id === job.id) ? list.map((j) => (j.id === job.id ? job : j)) : [job, ...list]));
  }, []);
  const remove = useCallback((id: string) => setJobs((list) => list.filter((j) => j.id !== id)), []);
  const resetDemo = useCallback(() => setJobs(withIds(SAMPLE_JOBS)), []);

  return { jobs, ready, save, remove, resetDemo };
}

/** Export CSV (séparateur « ; » pour Excel en français). */
export function jobsToCsv(jobs: Job[], headers: string[], statusLabel: (s: JobStatus) => string, tradeLabel: (t: TradeId) => string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = jobs.map((j) => [j.name, j.client, j.city, tradeLabel(j.trade), j.amount.toFixed(2).replace(".", ","), statusLabel(j.status), j.date, j.notes].map(esc).join(";"));
  return "﻿" + [headers.map(esc).join(";"), ...rows].join("\r\n");
}
