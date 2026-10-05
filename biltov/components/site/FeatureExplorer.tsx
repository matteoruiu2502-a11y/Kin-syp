"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Search } from "lucide-react";
import { CATEGORIES, FEATURES, searchKnowledge, type FeatureCategory } from "@/lib/knowledge/features";
import { cn } from "@/lib/utils";
import { FeatureIcon } from "./FeatureIcon";

/** Toutes les fonctionnalités en cartes cliquables, filtrables par catégorie et par recherche. */
export function FeatureExplorer() {
  const [cat, setCat] = useState<FeatureCategory | "all">("all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const base = q.trim().length > 2 ? searchKnowledge(q, FEATURES.length) : FEATURES;
    return cat === "all" ? base : base.filter((f) => f.category === cat);
  }, [cat, q]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4">
        <label className="relative mx-auto w-full max-w-xl">
          <span className="sr-only">Rechercher une fonctionnalité</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. : relancer un client, dicter un devis…" className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3.5 pl-12 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan" />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" role="tablist" aria-label="Catégories">
          {[{ id: "all" as const, label: "Tout" }, ...CATEGORIES].map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors", cat === c.id ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400 hover:text-white")}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {!list.length ? (
        <p className="text-center text-slate-400">Aucune fonctionnalité ne correspond. Essayez un autre mot, ou posez la question au chat d&apos;aide.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((f, i) => (
            <motion.li key={f.slug} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, delay: Math.min(i, 6) * 0.04 }}>
              <Link href={`/fonctionnalites/${f.slug}/`} className="card group flex h-full flex-col gap-3 p-6 transition-all hover:-translate-y-0.5 hover:border-cyan/40">
                <span className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue/20 to-emerald/20 text-cyan ring-1 ring-white/10">
                    <FeatureIcon name={f.icon} className="h-5 w-5" />
                  </span>
                  <ArrowUpRight className="h-5 w-5 text-slate-600 transition-colors group-hover:text-cyan" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{CATEGORIES.find((c) => c.id === f.category)?.label}</span>
                <span className="font-display text-xl font-bold text-white">{f.title}</span>
                <span className="text-sm leading-relaxed text-slate-400">{f.tagline}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
