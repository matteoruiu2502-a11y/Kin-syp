"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Car, Plus, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { round2 } from "@/lib/app/money";
import type { Vehicle } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Empty, Field, Modal, Notice, PageHeader, cellClass, inputClass } from "./ui";

function VehicleForm({ vehicle, onClose }: { vehicle: Vehicle | null; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, remove } = useAppData();
  const [v, setV] = useState<Vehicle>(vehicle ?? { id: uid(), plate: "", model: "", memberId: null, nextInspection: addDays(todayIso(), 365), nextService: addDays(todayIso(), 180), mileage: 0, costs: [] });
  const set = <K extends keyof Vehicle>(k: K, val: Vehicle[K]) => setV((x) => ({ ...x, [k]: val }));
  const setCost = (i: number, patch: Partial<Vehicle["costs"][number]>) => set("costs", v.costs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <Modal
      wide
      title={vehicle ? `${v.plate} — ${v.model}` : t("Nouveau véhicule")}
      onClose={onClose}
      footer={
        <>
          {vehicle && (
            <button onClick={() => window.confirm(t("Supprimer ce véhicule ?")) && (remove("vehicles", v.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!v.plate.trim()} onClick={() => (upsert("vehicles", v), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t("Plaque")} *`}>
            <input className={inputClass} value={v.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="1-ABC-123" />
          </Field>
          <Field label={t("Modèle")}>
            <input className={inputClass} value={v.model} onChange={(e) => set("model", e.target.value)} />
          </Field>
          <Field label={t("Conducteur")}>
            <select className={inputClass} value={v.memberId ?? ""} onChange={(e) => set("memberId", e.target.value || null)}>
              <option value="">—</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Prochain contrôle technique")}>
            <input type="date" className={inputClass} value={v.nextInspection} onChange={(e) => set("nextInspection", e.target.value)} />
          </Field>
          <Field label={t("Prochain entretien")}>
            <input type="date" className={inputClass} value={v.nextService} onChange={(e) => set("nextService", e.target.value)} />
          </Field>
          <Field label={t("Kilométrage")}>
            <input type="number" className={inputClass} value={v.mileage || ""} onChange={(e) => set("mileage", e.target.valueAsNumber || 0)} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Frais (carburant, pneus, réparations…)")}</p>
          <div className="space-y-2">
            {v.costs.map((c, i) => (
              <div key={i} className="grid grid-cols-[8.5rem_1fr_6rem_10rem_auto] gap-2">
                <input type="date" className={cellClass} value={c.date} onChange={(e) => setCost(i, { date: e.target.value })} />
                <input className={cellClass} value={c.label} onChange={(e) => setCost(i, { label: e.target.value })} placeholder={t("Libellé")} />
                <input type="number" step="0.01" className={cellClass} value={c.amount || ""} onChange={(e) => setCost(i, { amount: e.target.valueAsNumber || 0 })} placeholder="€ HTVA" />
                <select className={cellClass} value={c.jobId ?? ""} onChange={(e) => setCost(i, { jobId: e.target.value || null })}>
                  <option value="">{t("Frais généraux")}</option>
                  {data.jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => set("costs", v.costs.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={() => set("costs", [...v.costs, { date: todayIso(), label: "", amount: 0, jobId: null }])} className="btn-ghost !py-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> {t("Ajouter un frais")}
            </button>
          </div>
          <p className="mt-2 text-right text-sm text-slate-400">
            {t("Total")} : <span className="tabular-nums text-white">{f.money(round2(v.costs.reduce((s, c) => s + c.amount, 0)))}</span>
          </p>
        </div>
      </div>
    </Modal>
  );
}

export function FleetTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [editing, setEditing] = useState<Vehicle | "new" | null>(null);
  const soon = addDays(todayIso(), 30);
  const alerts = data.vehicles.flatMap((v) => [
    ...(v.nextInspection && v.nextInspection <= soon ? [`${v.plate} : ${t("contrôle technique le {d}", { d: f.date(v.nextInspection) })}`] : []),
    ...(v.nextService && v.nextService <= soon ? [`${v.plate} : ${t("entretien le {d}", { d: f.date(v.nextService) })}`] : []),
  ]);
  return (
    <div>
      <PageHeader
        title={t("Flotte")}
        subtitle={t("{n} véhicule(s)", { n: data.vehicles.length })}
        actions={
          <button onClick={() => setEditing("new")} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {t("Véhicule")}
          </button>
        }
      />
      {alerts.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            <AlertTriangle className="mr-1 inline h-4 w-4" /> {alerts.join(" · ")}
          </Notice>
        </div>
      )}
      {!data.vehicles.length ? (
        <Empty icon={Car} text={t("Suivez vos camionnettes : contrôle technique, entretiens, frais imputés aux chantiers.")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.vehicles.map((v) => (
            <button key={v.id} onClick={() => setEditing(v)} className="card p-5 text-left">
              <p className="font-display text-lg font-bold text-white">{v.plate}</p>
              <p className="text-sm text-slate-400">
                {v.model} · {data.members.find((m) => m.id === v.memberId)?.name ?? t("sans conducteur")}
              </p>
              <div className="mt-3 space-y-1 text-xs">
                <p className={cn(v.nextInspection <= soon ? "text-amber-300" : "text-slate-500")}>
                  {t("Contrôle technique")} : {f.date(v.nextInspection)}
                </p>
                <p className={cn(v.nextService <= soon ? "text-amber-300" : "text-slate-500")}>
                  {t("Entretien")} : {f.date(v.nextService)}
                </p>
                <p className="text-slate-500">
                  {f.num(v.mileage, 0)} km · {t("frais")} {f.money0(v.costs.reduce((s, c) => s + c.amount, 0))}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      <AnimatePresence>{editing && <VehicleForm vehicle={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
