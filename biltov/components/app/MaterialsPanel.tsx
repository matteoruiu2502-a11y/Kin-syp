"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Link2, Link2Off, PackageSearch } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { UNLINKED, closestPlanned, materialComparison, type MaterialRow, type MaterialSource } from "@/lib/app/materials";
import type { Job } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Empty, Notice, Stat } from "./ui";

const SOURCES: { id: MaterialSource; label: string }[] = [
  { id: "invoices", label: "Factures fournisseurs" },
  { id: "deliveries", label: "Bons de livraison" },
  { id: "stock", label: "Sorties de stock" },
];

const STATUS: Record<MaterialRow["status"], { label: string; style: string }> = {
  over: { label: "Dépassement", style: "border-rose-500/40 bg-rose-500/[0.06]" },
  under: { label: "Économie", style: "border-emerald/40 bg-emerald/[0.06]" },
  equal: { label: "Conforme", style: "border-white/10" },
  not_bought: { label: "Pas encore acheté", style: "border-white/10 opacity-70" },
  unplanned: { label: "Non prévu au devis", style: "border-amber-400/40 bg-amber-400/[0.06]" },
};

/** Matériaux prévus au devis contre quantités réellement achetées, par description. */
export function MaterialsPanel({ job }: { job: Job }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, can } = useAppData();
  const quotes = data.docs.filter((d) => d.jobId === job.id && d.type === "quote" && !d.template);
  const signed = quotes.filter((q) => q.status === "accepted");
  const [scope, setScope] = useState<string>(signed.length ? "signed" : (quotes[0]?.id ?? ""));
  const [sources, setSources] = useState<MaterialSource[]>(["invoices", "stock"]);
  const [open, setOpen] = useState<string | null>(null);
  const canLink = can("jobs", "edit") || can("purchases", "edit");
  const quoteIds = scope === "signed" ? signed.map((q) => q.id) : [scope];
  const links = job.materialLinks ?? {};
  const c = useMemo(() => materialComparison(data, job.id, { quoteIds, sources, links }), [data, job.id, quoteIds.join(), sources.join(), links]);
  const plannedKeys = c.rows.map((r) => r.key);
  const labelOf = (key: string) => c.rows.find((r) => r.key === key)?.label ?? key;

  const setLink = (actualKey: string, target: string | null) =>
    update((d) => ({
      ...d,
      jobs: d.jobs.map((j) => {
        if (j.id !== job.id) return j;
        const next = { ...(j.materialLinks ?? {}) };
        if (target === null) delete next[actualKey];
        else next[actualKey] = target;
        return { ...j, materialLinks: next };
      }),
    }));

  if (!quotes.length) return <Empty icon={PackageSearch} text={t("Aucun devis sur ce chantier : rien à comparer.")} />;

  const qty = (n: number, unit: string) => `${f.num(n, 2)}${unit ? ` ${unit}` : ""}`;
  const gapTone = (r: MaterialRow) => (r.status === "over" || r.status === "unplanned" ? "text-rose-300" : r.status === "under" ? "text-emerald" : "text-slate-400");
  const sign = (n: number) => (n > 0 ? "+" : "");

  const Detail = ({ r }: { r: MaterialRow }) => (
    <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-xs">
      {r.plannedLabels.length > 1 && (
        <p className="text-slate-400">
          {t("Regroupé au devis")} : {r.plannedLabels.map((l) => `« ${l} »`).join(", ")}
        </p>
      )}
      {!r.actual.length && <p className="text-slate-500">{t("Aucun achat trouvé pour ce matériau.")}</p>}
      {r.actual.map((a, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-slate-200">« {a.label} »</span>
            <span className="block text-slate-500">
              {a.origin} · {qty(a.qty, "")} · {f.money(a.cost)}
              {r.status !== "unplanned" && a.match === "auto" && <span className="ml-1 text-amber-300">· {t("rapproché automatiquement ({p} %)", { p: Math.round(a.score * 100) })}</span>}
              {a.match === "manual" && <span className="ml-1 text-cyan">· {t("associé manuellement")}</span>}
              {a.match === "article" && <span className="ml-1 text-slate-400">· {t("même article du catalogue")}</span>}
            </span>
          </span>
          {canLink && r.status !== "unplanned" && a.match !== "exact" && (
            <button onClick={() => setLink(a.key, UNLINKED)} className="btn-ghost !px-2.5 !py-1 text-xs">
              <Link2Off className="h-3.5 w-3.5" /> {t("Dissocier")}
            </button>
          )}
          {canLink && links[a.key] && (
            <button onClick={() => setLink(a.key, null)} className="text-xs text-cyan hover:underline">
              {t("Annuler l'association")}
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <select aria-label={t("Devis analysé")} className="rounded-xl border border-white/10 bg-ink/70 px-3 py-2 text-sm text-slate-100" value={scope} onChange={(e) => setScope(e.target.value)}>
          {signed.length > 0 && <option value="signed">{t("Devis signés et avenants ({n})", { n: signed.length })}</option>}
          {quotes.map((q) => (
            <option key={q.id} value={q.id}>
              {q.number ?? t("(brouillon)")} {q.isAmendment ? `· ${t("Avenant")}` : ""}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => {
            const on = sources.includes(s.id);
            return (
              <button key={s.id} aria-pressed={on} onClick={() => setSources(on ? sources.filter((x) => x !== s.id) : [...sources, s.id])} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", on ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-500")}>
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Coût matériaux prévu")} value={f.money0(c.plannedCost)} />
        <Stat label={t("Coût matériaux réel")} value={f.money0(c.actualCost)} tone={c.actualCost > c.plannedCost + 0.005 ? "danger" : "ok"} sub={`${sign(c.actualCost - c.plannedCost)}${f.money0(c.actualCost - c.plannedCost)}`} />
        <Stat label={t("Dépassements")} value={String(c.overCount)} tone={c.overCount ? "danger" : "ok"} />
        <Stat label={t("Économies")} value={String(c.underCount)} tone={c.underCount ? "ok" : undefined} />
      </div>

      {!c.rows.length ? (
        <Notice>{t("Ce devis ne contient pas de matériaux (seulement de la main-d'œuvre ou de la sous-traitance).")}</Notice>
      ) : (
        <ul className="space-y-2">
          {c.rows.map((r) => (
            <li key={r.key} className={cn("rounded-2xl border p-3 sm:p-4", STATUS[r.status].style)}>
              <button onClick={() => setOpen(open === r.key ? null : r.key)} className="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{r.label}</span>
                  <span className={cn("text-xs", gapTone(r))}>{t(STATUS[r.status].label)}</span>
                  {r.actual.some((a) => a.match === "auto") && <span className="ml-2 text-xs text-amber-300">· {t("descriptions rapprochées")}</span>}
                </span>
                <span className="grid grid-cols-3 gap-3 text-sm tabular-nums sm:w-[30rem] sm:grid-cols-4">
                  <span>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">{t("Prévu")}</span>
                    {qty(r.plannedQty, r.unit)}
                  </span>
                  <span>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">{t("Réel")}</span>
                    {qty(r.actualQty, r.unit)}
                  </span>
                  <span className={gapTone(r)}>
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">{t("Écart")}</span>
                    {sign(r.qtyGap)}
                    {f.num(r.qtyGap, 2)} {r.qtyGapPercent !== null && <span className="text-xs">({sign(r.qtyGapPercent)}{r.qtyGapPercent} %)</span>}
                  </span>
                  <span className="col-span-3 sm:col-span-1">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-500">{t("Coût prévu / réel")}</span>
                    <span className="text-slate-400">{f.money0(r.plannedCost)}</span> / <span className={r.costGap > 0.005 ? "text-rose-300" : r.costGap < -0.005 ? "text-emerald" : ""}>{f.money0(r.actualCost)}</span>
                  </span>
                </span>
                <ChevronDown className={cn("hidden h-4 w-4 shrink-0 text-slate-500 transition-transform sm:block", open === r.key && "rotate-180")} />
              </button>
              {open === r.key && <Detail r={r} />}
            </li>
          ))}
        </ul>
      )}

      {c.unplanned.length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold text-white">{t("Achats non prévus au devis")}</p>
          <p className="text-xs text-slate-500">{t("Si une description correspond à un matériau du devis (autre nom, faute de frappe), associez-la : Biltov s'en souviendra pour ce chantier.")}</p>
          {c.unplanned.map((r) => {
            const suggestions = closestPlanned(r.key, plannedKeys);
            return (
              <div key={r.key} className={cn("rounded-2xl border p-3 sm:p-4", STATUS.unplanned.style)}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{r.label}</span>
                    <span className="text-xs text-slate-400">
                      {qty(r.actualQty, "")} · <span className="text-rose-300">{f.money(r.actualCost)}</span> · {r.actual.map((a) => a.origin).join(", ")}
                    </span>
                  </span>
                  {canLink && plannedKeys.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <Link2 className="h-3.5 w-3.5" />
                      <select aria-label={t("Associer à un matériau du devis")} className="rounded-lg border border-white/10 bg-ink/70 px-2 py-1.5 text-xs text-slate-100" value="" onChange={(e) => e.target.value && setLink(r.key, e.target.value)}>
                        <option value="">{t("Associer à…")}</option>
                        {suggestions.map((s) => (
                          <option key={s.key} value={s.key}>
                            {labelOf(s.key)} ({Math.round(s.score * 100)} %)
                          </option>
                        ))}
                        <option disabled>──────────</option>
                        {plannedKeys
                          .filter((k) => !suggestions.some((s) => s.key === k))
                          .map((k) => (
                            <option key={k} value={k}>
                              {labelOf(k)}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-500">{t("Les descriptions sont comparées sans tenir compte des majuscules, accents, espaces et pluriels ; les descriptions très proches (fautes de frappe) sont rapprochées automatiquement. Main-d'œuvre et lignes sous-traitées sont exclues. Quantités comparées dans l'unité du devis.")}</p>
    </div>
  );
}
