"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CalendarClock, Calculator, Plus, Repeat, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso, uid } from "@/lib/app/defaults";
import { contractAmount, dueContracts, generateOccurrence, yearlyValue } from "@/lib/app/contracts";
import { CATEGORY, UNITS } from "@/lib/app/labels";
import type { Contract, ContractFrequency, LineCategory } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, Stat, Toggle, cellClass, inputClass } from "./ui";
import { QuantityCalculator } from "./QuantityCalculator";

export const FREQUENCY: Record<ContractFrequency, string> = { weekly: "Hebdomadaire", monthly: "Mensuel", quarterly: "Trimestriel", yearly: "Annuel" };

function ContractForm({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, remove } = useAppData();
  const [c, setC] = useState(contract);
  const [calc, setCalc] = useState(false);
  const exists = data.contracts.some((x) => x.id === c.id);
  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setC((x) => ({ ...x, [k]: v }));
  const setLine = (i: number, patch: Partial<Contract["lines"][number]>) => set("lines", c.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Modal
      wide="xl"
      title={c.title || t("Nouveau contrat d'entretien")}
      onClose={onClose}
      footer={
        <>
          {exists && (
            <button onClick={() => window.confirm(t("Supprimer ?")) && (remove("contracts", c.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!c.title.trim() || !c.clientId || !c.lines.length} onClick={() => (upsert("contracts", c), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t("Intitulé")} *`}>
            <input className={inputClass} value={c.title} onChange={(e) => set("title", e.target.value)} placeholder={t("Tonte et taille — villa Durand")} />
          </Field>
          <Field label={`${t("Client")} *`}>
            <select className={inputClass} value={c.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">—</option>
              {data.clients.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Fréquence")}>
            <select className={inputClass} value={c.frequency} onChange={(e) => set("frequency", e.target.value as ContractFrequency)}>
              {(Object.keys(FREQUENCY) as ContractFrequency[]).map((k) => (
                <option key={k} value={k}>
                  {t(FREQUENCY[k])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Prochaine intervention")}>
            <input type="date" className={inputClass} value={c.nextDate} onChange={(e) => set("nextDate", e.target.value)} />
          </Field>
          <Field label={t("Fin du contrat")}>
            <input type="date" className={inputClass} value={c.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} />
          </Field>
          <div className="pt-6">
            <Toggle checked={c.active} onChange={(v) => set("active", v)} label={t("Contrat actif")} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Équipe")}</p>
          <div className="flex flex-wrap gap-2">
            {data.members
              .filter((m) => m.active)
              .map((m) => {
                const on = c.memberIds.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => set("memberIds", on ? c.memberIds.filter((x) => x !== m.id) : [...c.memberIds, m.id])} className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400")}>
                    {m.name}
                  </button>
                );
              })}
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-2">{t("Prestation")}</th>
                <th className="w-20 p-2">{t("Qté")}</th>
                <th className="w-24 p-2">{t("Unité")}</th>
                <th className="w-28 p-2">{t("PU HTVA")}</th>
                <th className="w-48 p-2">{t("Nature (pour la TVA)")}</th>
                <th className="w-24 p-2 text-right">{t("Total")}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {c.lines.map((l, i) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-1.5">
                    <input className={cn(cellClass, "w-full")} value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" step="any" className={cn(cellClass, "w-full")} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.valueAsNumber || 0 })} />
                  </td>
                  <td className="p-1.5">
                    <select className={cn(cellClass, "w-full")} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}>
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input type="number" step="0.01" className={cn(cellClass, "w-full")} value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.valueAsNumber || 0 })} />
                  </td>
                  <td className="p-1.5">
                    <select className={cn(cellClass, "w-full")} value={l.category} onChange={(e) => setLine(i, { category: e.target.value as LineCategory })}>
                      {(Object.keys(CATEGORY) as LineCategory[]).map((k) => (
                        <option key={k} value={k}>
                          {t(CATEGORY[k])}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5 text-right tabular-nums">{f.money(l.qty * l.unitPrice)}</td>
                  <td>
                    <button onClick={() => set("lines", c.lines.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2 border-t border-white/5 p-2">
            <button onClick={() => set("lines", [...c.lines, { label: "", qty: 1, unit: "h", unitPrice: 0, category: "garden_maintenance" }])} className="btn-ghost !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t("Ligne")}
            </button>
            <button onClick={() => setCalc(true)} className="btn-ghost !py-1.5 text-xs">
              <Calculator className="h-3.5 w-3.5" /> {t("Calculateur")}
            </button>
          </div>
        </div>
        <p className="text-right text-sm text-slate-400">
          {t("Par intervention")} : <span className="tabular-nums text-white">{f.money(contractAmount(c))}</span> HTVA · {t("par an")} : <span className="tabular-nums text-white">{f.money(yearlyValue(c))}</span>
        </p>
        <Notice>{t("Parcs & jardins : l'entretien (tonte, taille) est facturé à 21 % ; l'aménagement de jardin est exclu du 6 %. Le moteur TVA applique ces règles selon la nature de chaque ligne — à valider par votre comptable.")}</Notice>
      </div>
      <AnimatePresence>
        {calc && (
          <QuantityCalculator
            onClose={() => setCalc(false)}
            onInsert={(r) => {
              set("lines", [...c.lines, { label: r.label, qty: r.qty, unit: r.unit, unitPrice: 0, category: r.category }]);
              setCalc(false);
            }}
          />
        )}
      </AnimatePresence>
    </Modal>
  );
}

export function ContractsTab({ onOpenDoc }: { onOpenDoc: (id: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, run } = useAppData();
  const [editing, setEditing] = useState<Contract | null>(null);
  const due = dueContracts(data);
  const active = data.contracts.filter((c) => c.active);
  const blank = (): Contract => ({ id: uid(), clientId: "", jobId: null, title: "", frequency: "monthly", startDate: todayIso(), nextDate: todayIso(), endDate: null, lines: [{ label: t("Tonte de pelouse"), qty: 1, unit: "h", unitPrice: 45, category: "garden_maintenance" }], memberIds: [], active: true, history: [] });

  return (
    <div>
      <PageHeader
        title={t("Contrats d'entretien")}
        subtitle={t("Interventions récurrentes : tonte, taille, entretien chaudière…")}
        actions={
          <button onClick={() => setEditing(blank())} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {t("Contrat")}
          </button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Contrats actifs")} value={String(active.length)} />
        <Stat label={t("Chiffre d'affaires récurrent (an)")} value={f.money0(active.reduce((s, c) => s + yearlyValue(c), 0))} />
        <Stat label={t("Échéances à générer (7 j)")} value={String(due.length)} tone={due.length ? "warn" : "ok"} />
      </div>
      {!data.contracts.length ? (
        <Empty icon={Repeat} text={t("Créez vos contrats d'entretien : Biltov prépare la facture et l'intervention au planning à chaque échéance.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {data.contracts.map((c) => {
            const isDue = due.includes(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => setEditing(c)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-slate-100">{c.title}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {data.clients.find((x) => x.id === c.clientId)?.name} · {t(FREQUENCY[c.frequency])} · {f.money(contractAmount(c))} HTVA
                  </span>
                </button>
                <span className={cn("flex items-center gap-1 text-xs", isDue ? "text-amber-300" : "text-slate-400")}>
                  <CalendarClock className="h-3.5 w-3.5" /> {f.date(c.nextDate)}
                </span>
                {!c.active && <Badge label={t("Inactif")} style="bg-white/5 text-slate-400 ring-white/10" />}
                {c.active && (
                  <button
                    onClick={() => {
                      const r = run((d) => generateOccurrence(d, c.id));
                      if (r) onOpenDoc(r.invoice.id);
                    }}
                    className={cn("!px-3 !py-1.5 text-xs", isDue ? "btn-primary" : "btn-ghost")}
                  >
                    {t("Générer l'échéance")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AnimatePresence>{editing && <ContractForm key={editing.id} contract={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
