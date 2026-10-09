"use client";

// Tarifs : 3 forfaits (Pro mis en avant), bascule mensuel / annuel, tableau comparatif et FAQ.
// Tous les chiffres viennent de lib/plans.ts ; les textes, de lib/content (FR / NL / DE).

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Minus, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { trialHref } from "@/lib/checkout";
import { HIGHLIGHTED_PLAN, PLANS, PLAN_ORDER, monthlyEquivalentHT, priceHT, type Cycle, type Feature, type PlanId } from "@/lib/plans";
import { SectionHeading } from "./SectionHeading";
import { Reveal } from "./Reveal";

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

/** Lignes du tableau comparatif : une ligne = un groupe de fonctionnalités (toutes requises). */
const ROWS: { key: "docs" | "crm" | "money" | "stock" | "ops" | "planning" | "team" | "roles" | "subcontract" | "gantt" | "profit" | "mode3d"; features: Feature[] }[] = [
  { key: "docs", features: ["quotes", "invoices"] },
  { key: "crm", features: ["clients", "jobs", "catalog"] },
  { key: "money", features: ["money", "bank", "accounting"] },
  { key: "stock", features: ["stock"] },
  { key: "ops", features: ["purchases", "fleet", "tools", "contracts"] },
  { key: "planning", features: ["planning", "modules"] },
  { key: "team", features: ["team", "time", "worker"] },
  { key: "roles", features: ["customRoles"] },
  { key: "subcontract", features: ["subcontractLines", "subcontractors"] },
  { key: "gantt", features: ["gantt", "weather"] },
  { key: "profit", features: ["profit", "materials"] },
  { key: "mode3d", features: ["mode3d"] },
];

function useMoney() {
  const { locale } = useI18n();
  return (n: number) => n.toLocaleString(locale, { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
}

function CycleSwitch({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  const { t } = useI18n();
  const p = t.pricing;
  return (
    <div role="group" aria-label={`${p.monthly} / ${p.yearly}`} className="relative flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
      {(["monthly", "yearly"] as Cycle[]).map((c) => (
        <button key={c} onClick={() => onChange(c)} aria-pressed={cycle === c} className={cn("relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors", cycle === c ? "text-white" : "text-slate-400 hover:text-white")}>
          {cycle === c && <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-blue" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
          <span className="relative">{c === "monthly" ? p.monthly : p.yearly}</span>
          {c === "yearly" && <span className="relative rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-bold text-emerald ring-1 ring-emerald/40">{p.save}</span>}
        </button>
      ))}
    </div>
  );
}

/** Trois cartes de forfait. */
export function PricingCards({ cycle }: { cycle: Cycle }) {
  const { t } = useI18n();
  const p = t.pricing;
  const money = useMoney();
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLAN_ORDER.map((id, i) => {
        const plan = PLANS[id];
        const featured = id === HIGHLIGHTED_PLAN;
        const copy = p.plans[id];
        return (
          <Reveal key={id} delay={0.05 * i} className={cn("relative flex flex-col rounded-[1.5rem] border p-7", featured ? "border-transparent bg-night ring-2 ring-[var(--brand)] lg:-my-3 lg:py-10" : "border-white/10 bg-white/[0.02]")}>
            {featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue px-3 py-1 text-xs font-bold text-white">{p.popular}</span>}
            <h3 className="font-display text-2xl font-bold text-white">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-400">{copy.audience}</p>
            <p className="mt-6 flex items-end gap-2">
              <span className="font-display text-5xl font-extrabold leading-none tracking-tight text-white tabular-nums">{money(monthlyEquivalentHT(id, cycle))}</span>
              <span className="pb-1 text-sm text-slate-400">{p.perMonth}</span>
            </p>
            <p className="mt-2 min-h-5 text-xs text-slate-500">{cycle === "yearly" ? fill(p.billedYearly, { p: money(priceHT(id, cycle)) }) : p.billedMonthly}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-300">
              {[p.unlimitedQuotes, fill(p.invoices, { n: plan.invoicesPerMonth }) + (plan.overagePrice !== null ? `, ${fill(p.overage, { p: money(plan.overagePrice) })}` : ""), plan.maxUsers === null ? p.usersInf : plan.maxUsers === 1 ? p.users1 : fill(p.usersN, { n: plan.maxUsers }), ...copy.points].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan" strokeWidth={3} />
                  {line}
                </li>
              ))}
            </ul>
            <a href={trialHref()} className={cn("group mt-8 text-sm", featured ? "btn-primary" : "btn-ghost")}>
              {p.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Reveal>
        );
      })}
    </div>
  );
}

/** Tableau comparatif des fonctionnalités. */
export function PricingCompare({ cycle }: { cycle: Cycle }) {
  const { t } = useI18n();
  const p = t.pricing;
  const r = p.rows;
  const money = useMoney();
  const yes = <Check className="mx-auto h-4 w-4 text-cyan" strokeWidth={3} aria-label="✓" />;
  const no = <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="—" />;
  const cell = (id: PlanId, content: React.ReactNode) => (
    <td key={id} className={cn("px-3 py-3 text-center tabular-nums", id === HIGHLIGHTED_PLAN && "bg-blue/[0.06]")}>
      {content}
    </td>
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="px-4 py-3 font-semibold text-slate-400">{p.compareTitle}</th>
            {PLAN_ORDER.map((id) => (
              <th key={id} className={cn("px-3 py-3 text-center font-display text-base font-bold text-white", id === HIGHLIGHTED_PLAN && "bg-blue/[0.06]")}>
                {PLANS[id].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium">{r.price}</th>
            {PLAN_ORDER.map((id) => cell(id, <span className="font-semibold text-white">{money(monthlyEquivalentHT(id, cycle))} €</span>))}
          </tr>
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium">{r.quotes}</th>
            {PLAN_ORDER.map((id) => cell(id, r.unlimited))}
          </tr>
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium">{r.invoices}</th>
            {PLAN_ORDER.map((id) => cell(id, PLANS[id].invoicesPerMonth))}
          </tr>
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium">{r.overage}</th>
            {PLAN_ORDER.map((id) => cell(id, PLANS[id].overagePrice !== null ? `${money(PLANS[id].overagePrice!)} ${p.perMonth.split(" / ")[0]}` : r.overageBlocked))}
          </tr>
          <tr>
            <th scope="row" className="px-4 py-3 text-left font-medium">{r.users}</th>
            {PLAN_ORDER.map((id) => cell(id, PLANS[id].maxUsers ?? "∞"))}
          </tr>
          {ROWS.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-4 py-3 text-left font-medium">{r[row.key]}</th>
              {PLAN_ORDER.map((id) => cell(id, row.features.every((f) => PLANS[id].features.includes(f)) ? yes : no))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** FAQ courte sur les forfaits. */
export function PricingFaq() {
  const { t } = useI18n();
  const p = t.pricing;
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-center font-display text-2xl font-bold text-white">{p.faqTitle}</h2>
      <div className="space-y-3">
        {p.faq.map((f) => (
          <details key={f.q} className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <summary className="cursor-pointer list-none font-semibold text-white marker:hidden">{f.q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

/** Note sous les cartes : essai, TVA. */
function PricingNote() {
  const { t } = useI18n();
  const p = t.pricing;
  return (
    <p className="mt-8 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-slate-500">
      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> {p.guarantee} · {p.vatNote}
    </p>
  );
}

/** Section « Tarifs » de la page d'accueil : les cartes, puis un lien vers la comparaison détaillée. */
export function Pricing() {
  const { t } = useI18n();
  const p = t.pricing;
  const [cycle, setCycle] = useState<Cycle>("monthly");
  return (
    <section id="tarif" className="relative py-24 sm:py-32">
      <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={p.eyebrow} title={p.title} subtitle={p.subtitle} />
        <Reveal className="mb-12 flex justify-center">
          <CycleSwitch cycle={cycle} onChange={setCycle} />
        </Reveal>
        <PricingCards cycle={cycle} />
        <PricingNote />
        <p className="mt-6 text-center">
          <Link href="/tarifs/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:underline">
            {p.compareLink} <ArrowRight className="h-4 w-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}

/** Contenu complet de la page /tarifs/ : cartes, tableau comparatif et FAQ. */
export function PricingPage() {
  const { t } = useI18n();
  const p = t.pricing;
  const [cycle, setCycle] = useState<Cycle>("monthly");
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-blue" /> {p.eyebrow}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">{p.title}</h1>
          <p className="mt-5 text-lg text-slate-400">{p.subtitle}</p>
        </Reveal>
        <div className="mb-12 flex justify-center">
          <CycleSwitch cycle={cycle} onChange={setCycle} />
        </div>
        <PricingCards cycle={cycle} />
        <PricingNote />
      </section>
      <section className="mx-auto mt-20 max-w-5xl px-4 sm:px-6">
        <h2 className="mb-6 text-center font-display text-2xl font-bold text-white">{p.compareTitle}</h2>
        <PricingCompare cycle={cycle} />
        <p className="mt-3 text-center text-xs text-slate-500">{p.vatNote}</p>
      </section>
      <section className="mt-20 px-4 pb-24 sm:px-6">
        <PricingFaq />
      </section>
    </>
  );
}
