"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { jobProfit, type CostPost } from "@/lib/app/profit";
import type { Job } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Stat } from "./ui";

const POST_LABEL: Record<CostPost, string> = {
  materials: "Matières (achats, tickets, stock)",
  labour: "Main-d'œuvre (heures × coût chargé)",
  subcontracting: "Sous-traitance",
  equipment: "Matériel, location, véhicules",
};

/** Tableau de bord de rentabilité d'un chantier : prévu (devis) contre réel, en temps réel. */
export function JobProfitPanel({ job }: { job: Job }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const p = jobProfit(data, job.id);
  const max = Math.max(1, ...p.rows.flatMap((r) => [r.planned, r.actual + r.committed]));
  const better = p.actualMargin >= p.plannedMargin;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("CA vendu (devis + avenants)")} value={f.money0(p.sold)} sub={p.amendments ? t("dont avenants {a}", { a: f.money0(p.amendments) }) : undefined} />
        <Stat label={t("CA facturé")} value={f.money0(p.invoiced)} sub={t("{p} % du vendu · encaissé {c}", { p: p.invoicedProgress, c: f.money0(p.cashed) })} />
        <Stat label={t("Coûts réels")} value={f.money0(p.actualCost + p.committedCost)} sub={t("{p} % du budget · {h} h", { p: p.costProgress, h: f.num(p.hours, 1) })} tone={p.costProgress > 100 ? "danger" : p.costProgress > 85 ? "warn" : undefined} />
        <Stat label={t("Marge brute réelle")} value={`${f.money0(p.actualMargin)} · ${p.actualMarginRate} %`} sub={t("prévue : {m} · {r} %", { m: f.money0(p.plannedMargin), r: p.plannedMarginRate })} tone={p.actualMargin < 0 ? "danger" : better ? "ok" : "warn"} />
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-white">{t("Prévu (devis) contre réel, par poste")}</p>
          <span className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-white/20" /> {t("Prévu")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-cyan" /> {t("Réel")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-amber-400" /> {t("Engagé (livré, non facturé)")}
            </span>
          </span>
        </div>
        <div className="space-y-4">
          {p.rows.map((r) => {
            const over = r.actual + r.committed > r.planned + 0.005 && r.planned > 0;
            return (
              <div key={r.post}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="text-slate-300">{t(POST_LABEL[r.post])}</span>
                  <span className="tabular-nums text-slate-400">
                    <span className={cn(over ? "text-rose-300" : "text-white")}>{f.money0(r.actual + r.committed)}</span> / {f.money0(r.planned)}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-white/5">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-white/20" style={{ width: `${(r.planned / max) * 100}%` }} />
                  <span className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-rose-500" : "bg-cyan")} style={{ width: `${(r.actual / max) * 100}%` }} />
                  {r.committed > 0 && <span className="absolute inset-y-0 rounded-full bg-amber-400" style={{ left: `${(r.actual / max) * 100}%`, width: `${(r.committed / max) * 100}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-2">{t("Poste")}</th>
              <th className="py-2 text-right">{t("Prévu")}</th>
              <th className="py-2 text-right">{t("Réel")}</th>
              <th className="py-2 text-right">{t("Engagé")}</th>
              <th className="py-2 text-right">{t("Écart")}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-t border-white/5">
              <td className="py-2 text-slate-300">{t("Chiffre d'affaires HTVA")}</td>
              <td className="py-2 text-right">{f.money(p.sold)}</td>
              <td className="py-2 text-right">{f.money(Math.max(p.sold, p.invoiced))}</td>
              <td />
              <td />
            </tr>
            {p.rows.map((r) => {
              const gap = r.actual + r.committed - r.planned;
              return (
                <tr key={r.post} className="border-t border-white/5">
                  <td className="py-2 text-slate-300">{t(POST_LABEL[r.post])}</td>
                  <td className="py-2 text-right">{f.money(r.planned)}</td>
                  <td className="py-2 text-right">{f.money(r.actual)}</td>
                  <td className="py-2 text-right text-amber-300">{r.committed ? f.money(r.committed) : ""}</td>
                  <td className={cn("py-2 text-right", gap > 0.005 ? "text-rose-300" : "text-emerald")}>{f.money(gap)}</td>
                </tr>
              );
            })}
            <tr className="border-t border-white/10 font-bold text-white">
              <td className="py-2">{t("Marge brute")}</td>
              <td className="py-2 text-right">{f.money(p.plannedMargin)}</td>
              <td className={cn("py-2 text-right", p.actualMargin < 0 ? "text-rose-300" : "text-emerald")}>{f.money(p.actualMargin)}</td>
              <td />
              <td className="py-2 text-right">
                <span className="inline-flex items-center gap-1">
                  {better ? <TrendingUp className="h-4 w-4 text-emerald" /> : <TrendingDown className="h-4 w-4 text-rose-300" />}
                  {p.actualMarginRate} %
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">
          {t("Prévu : prix de revient des lignes des devis et avenants signés. Réel : factures d'achat, tickets, sorties de stock, heures pointées, location et véhicules imputés au chantier. Engagé : commandes livrées dont la facture fournisseur n'est pas encore encodée.")}
        </p>
      </div>
    </div>
  );
}
