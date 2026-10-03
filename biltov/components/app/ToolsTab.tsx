"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRightLeft, Plus, Wrench } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { nowIso, todayIso, uid } from "@/lib/app/defaults";
import { assignTool, assignmentLabel, nextService, serviceDue } from "@/lib/app/tools";
import type { Tool, ToolAssignment } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, PageHeader, SearchBox, Stat, inputClass } from "./ui";

const STATUS: Record<Tool["status"], { label: string; style: string }> = {
  ok: { label: "En service", style: "bg-emerald/10 text-emerald ring-emerald/30" },
  repair: { label: "En réparation", style: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  lost: { label: "Perdu / volé", style: "bg-rose-500/10 text-rose-300 ring-rose-500/30" },
  retired: { label: "Réformé", style: "bg-white/5 text-slate-400 ring-white/10" },
};

function AssignmentPicker({ value, onChange }: { value: ToolAssignment; onChange: (a: ToolAssignment) => void }) {
  const { t } = useTr();
  const { data } = useAppData();
  const options: { a: ToolAssignment; label: string }[] = [
    { a: { type: "depot", id: null }, label: t("Dépôt") },
    ...data.vehicles.map((v) => ({ a: { type: "vehicle" as const, id: v.id }, label: `🚐 ${v.plate}` })),
    ...data.members.filter((m) => m.active).map((m) => ({ a: { type: "member" as const, id: m.id }, label: `👷 ${m.name}` })),
    ...data.jobs.filter((j) => ["accepted", "in_progress"].includes(j.status)).map((j) => ({ a: { type: "job" as const, id: j.id }, label: `🏗 ${j.name}` })),
  ];
  const key = (a: ToolAssignment) => `${a.type}:${a.id ?? ""}`;
  return (
    <select className={inputClass} value={key(value)} onChange={(e) => onChange(options.find((o) => key(o.a) === e.target.value)!.a)}>
      {options.map((o) => (
        <option key={key(o.a)} value={key(o.a)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToolForm({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, update, remove } = useAppData();
  const [x, setX] = useState(tool);
  const [moveTo, setMoveTo] = useState<ToolAssignment>(tool.assignment);
  const [note, setNote] = useState("");
  const exists = data.tools.some((y) => y.id === x.id);
  const set = <K extends keyof Tool>(k: K, v: Tool[K]) => setX((y) => ({ ...y, [k]: v }));
  return (
    <Modal
      wide
      title={x.name || t("Nouvel outil / machine")}
      onClose={onClose}
      footer={
        <>
          {exists && (
            <button onClick={() => window.confirm(t("Supprimer ?")) && (remove("tools", x.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!x.name.trim()} onClick={() => (upsert("tools", exists ? x : { ...x, history: [{ at: nowIso(), assignment: x.assignment, note: t("Mise en service") }] }), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`${t("Nom")} *`}>
            <input className={inputClass} value={x.name} onChange={(e) => set("name", e.target.value)} placeholder={t("Minipelle, laser rotatif, disqueuse…")} />
          </Field>
          <Field label={t("Catégorie")}>
            <input className={inputClass} list="tool-cats" value={x.category} onChange={(e) => set("category", e.target.value)} />
            <datalist id="tool-cats">
              {["Machine", "Électroportatif", "Mesure", "Échafaudage", "Sécurité", "Jardin"].map((c) => (
                <option key={c} value={t(c)} />
              ))}
            </datalist>
          </Field>
          <Field label={t("N° de série")}>
            <input className={inputClass} value={x.serial} onChange={(e) => set("serial", e.target.value)} />
          </Field>
          <Field label={t("Date d'achat")}>
            <input type="date" className={inputClass} value={x.purchaseDate ?? ""} onChange={(e) => set("purchaseDate", e.target.value || null)} />
          </Field>
          <Field label={t("Valeur (€)")}>
            <input type="number" className={inputClass} value={x.value || ""} onChange={(e) => set("value", e.target.valueAsNumber || 0)} />
          </Field>
          <Field label={t("Statut")}>
            <select className={inputClass} value={x.status} onChange={(e) => set("status", e.target.value as Tool["status"])}>
              {(Object.keys(STATUS) as Tool["status"][]).map((k) => (
                <option key={k} value={k}>
                  {t(STATUS[k].label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Entretien tous les (jours)")}>
            <input type="number" className={inputClass} value={x.serviceIntervalDays ?? ""} onChange={(e) => set("serviceIntervalDays", e.target.valueAsNumber || null)} />
          </Field>
          <Field label={t("Dernier entretien")} hint={nextService(x) ? t("Prochain : {d}", { d: f.date(nextService(x)!) }) : undefined}>
            <input type="date" className={inputClass} value={x.lastService ?? ""} onChange={(e) => set("lastService", e.target.value || null)} />
          </Field>
          {!exists && (
            <Field label={t("Affecté à")}>
              <AssignmentPicker value={x.assignment} onChange={(a) => set("assignment", a)} />
            </Field>
          )}
        </div>
        {exists && (
          <div className="space-y-3 rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-white">
              {t("Affectation actuelle")} : <span className="text-cyan">{t(assignmentLabel(data, x.assignment))}</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <AssignmentPicker value={moveTo} onChange={setMoveTo} />
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Note (facultatif)")} />
              <button
                onClick={() => {
                  update((d) => assignTool(d, x.id, moveTo, note));
                  setX((y) => ({ ...y, assignment: moveTo, history: [...y.history, { at: nowIso(), assignment: moveTo, note }] }));
                  setNote("");
                }}
                className="btn-primary !py-2.5 text-sm"
              >
                <ArrowRightLeft className="h-4 w-4" /> {t("Réaffecter")}
              </button>
            </div>
            <button onClick={() => set("lastService", todayIso())} className="btn-ghost !py-1.5 text-xs">
              <Wrench className="h-3.5 w-3.5" /> {t("Entretien fait aujourd'hui")}
            </button>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
              {[...x.history].reverse().map((h, i) => (
                <li key={i}>
                  {new Date(h.at).toLocaleString(f.locale)} → {t(assignmentLabel(data, h.assignment))} {h.note && `· ${h.note}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ToolsTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [editing, setEditing] = useState<Tool | null>(null);
  const [q, setQ] = useState("");
  const due = data.tools.filter((x) => serviceDue(x));
  const list = data.tools.filter((x) => !q || `${x.name} ${x.category} ${x.serial} ${assignmentLabel(data, x.assignment)}`.toLowerCase().includes(q.toLowerCase()));
  const blank = (): Tool => ({ id: uid(), name: "", category: "", serial: "", purchaseDate: todayIso(), value: 0, assignment: { type: "depot", id: null }, history: [], serviceIntervalDays: null, lastService: null, status: "ok", notes: "" });

  return (
    <div>
      <PageHeader
        title={t("Outils & matériel")}
        subtitle={t("Machines et outillage : affectation, historique, entretien")}
        actions={
          <button onClick={() => setEditing(blank())} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {t("Outil / machine")}
          </button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Outils et machines")} value={String(data.tools.filter((x) => x.status !== "retired").length)} />
        <Stat label={t("Valeur du parc")} value={f.money0(data.tools.filter((x) => x.status !== "retired").reduce((s, x) => s + x.value, 0))} />
        <Stat label={t("Entretiens à prévoir (14 j)")} value={String(due.length)} tone={due.length ? "warn" : "ok"} />
      </div>
      {due.length > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-2 p-4 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          {due.map((x) => `${x.name} (${f.date(nextService(x)!)})`).join(" · ")}
        </div>
      )}
      <div className="mb-4">
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : outil, n° de série, affectation…")} />
      </div>
      {!data.tools.length ? (
        <Empty icon={Wrench} text={t("Suivez vos machines et outils : qui les a, sur quel chantier, et quand les entretenir.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {list.map((x) => (
            <li key={x.id}>
              <button onClick={() => setEditing(x)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-100">{x.name}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {x.category} {x.serial && `· ${x.serial}`}
                  </span>
                </span>
                <span className="text-slate-300">{t(assignmentLabel(data, x.assignment))}</span>
                <span className={cn("text-xs", serviceDue(x) ? "text-amber-300" : "text-slate-500")}>{nextService(x) ? `${t("Entretien")} ${f.date(nextService(x)!)}` : "—"}</span>
                <Badge label={t(STATUS[x.status].label)} style={STATUS[x.status].style} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{editing && <ToolForm key={editing.id} tool={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
