"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Clock, Download, Plus, Receipt, Users } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { ROLE } from "@/lib/app/labels";
import { mondayOf, weekDays } from "@/lib/app/planning";
import { toCsv } from "@/lib/app/finance";
import { downloadBlob } from "@/lib/app/send";
import type { Expense, Member, Role, TimeEntry } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, SubTabs, Toggle, inputClass } from "./ui";
import { TimeForm } from "./FieldPanels";
import { ExpenseForm, expenseHt } from "./ExpensesPanel";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export const ROLE_RIGHTS: Record<Role, string> = {
  owner: "Tout, y compris paramètres, prix et exports.",
  office: "Clients, devis, factures, planning, achats. Pas les paramètres de l'entreprise.",
  worker: "Espace ouvrier : son planning, pointage, photos, rapports, tickets. Aucun prix.",
  accountant: "Lecture des factures, achats, argent à recevoir et exports comptables.",
};

function MemberForm({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert } = useAppData();
  const [m, setM] = useState<Member>(member ?? { id: uid(), name: "", role: "worker", phone: "", email: "", lang: data.company.lang, hourlyCost: 35, color: COLORS[data.members.length % COLORS.length], pin: "", active: true });
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setM((x) => ({ ...x, [k]: v }));
  const pinOk = !m.pin || /^\d{4,6}$/.test(m.pin);
  return (
    <Modal
      title={member ? t("Modifier le membre") : t("Nouveau membre de l'équipe")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!m.name.trim() || !pinOk} onClick={() => (upsert("members", m), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t("Nom")} *`}>
          <input className={inputClass} value={m.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label={t("Rôle")} hint={t(ROLE_RIGHTS[m.role])}>
          <select className={inputClass} value={m.role} onChange={(e) => set("role", e.target.value as Role)}>
            {(Object.keys(ROLE) as Role[]).map((r) => (
              <option key={r} value={r}>
                {t(ROLE[r])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Téléphone")}>
          <input className={inputClass} value={m.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={t("E-mail")}>
          <input type="email" className={inputClass} value={m.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label={t("Langue")}>
          <select className={inputClass} value={m.lang} onChange={(e) => set("lang", e.target.value as Member["lang"])}>
            <option value="fr">Français</option>
            <option value="nl">Nederlands</option>
            <option value="de">Deutsch</option>
          </select>
        </Field>
        <Field label={t("Coût horaire chargé (€)")} hint={t("Sert au calcul de rentabilité des chantiers.")}>
          <input type="number" step="0.5" className={inputClass} value={m.hourlyCost || ""} onChange={(e) => set("hourlyCost", e.target.valueAsNumber || 0)} />
        </Field>
        <Field label={t("Code PIN (4 à 6 chiffres)")} error={!pinOk && t("4 à 6 chiffres.")} hint={t("Pour ouvrir son espace sur un téléphone partagé.")}>
          <input inputMode="numeric" className={inputClass} value={m.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
        <Field label={t("Couleur au planning")}>
          <div className="flex gap-2 pt-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => set("color", c)} className={cn("h-7 w-7 rounded-full", m.color === c && "ring-2 ring-white ring-offset-2 ring-offset-ink")} style={{ background: c }} aria-label={c} />
            ))}
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Toggle checked={m.active} onChange={(v) => set("active", v)} label={t("Actif")} hint={t("Un membre inactif n'apparaît plus au planning.")} />
        </div>
      </div>
    </Modal>
  );
}

export function TeamTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const [tab, setTab] = useState<"members" | "hours" | "expenses">("members");
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const [time, setTime] = useState<TimeEntry | "new" | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [monday, setMonday] = useState(mondayOf(todayIso()));
  const days = weekDays(monday);
  const week = data.timeEntries.filter((e) => e.date >= days[0] && e.date <= days[6]);
  const hours = (memberId: string, day?: string) => week.filter((e) => e.memberId === memberId && (!day || e.date === day)).reduce((s, e) => s + e.hours, 0);
  const notes = useMemo(() => data.expenses.filter((e) => e.reimbursable).sort((a, b) => b.date.localeCompare(a.date)), [data.expenses]);

  const exportHours = () => {
    const rows = week
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => [data.members.find((m) => m.id === e.memberId)?.name ?? "", e.date, e.start, e.end, e.hours, data.jobs.find((j) => j.id === e.jobId)?.name ?? "", e.note]);
    downloadBlob(new Blob([toCsv(["Ouvrier", "Date", "Début", "Fin", "Heures", "Chantier", "Note"], rows)], { type: "text/csv;charset=utf-8" }), `heures-${monday}.csv`);
  };

  return (
    <div>
      <PageHeader
        title={t("Équipe")}
        subtitle={t("{n} membre(s)", { n: data.members.length })}
        actions={
          <button onClick={() => setEditing("new")} className="btn-primary !py-2.5 text-sm">
            <Plus className="h-4 w-4" /> {t("Ajouter")}
          </button>
        }
      />
      <div className="mb-6">
        <SubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "members", label: t("Membres"), count: data.members.length },
            { id: "hours", label: t("Heures de la semaine") },
            { id: "expenses", label: t("Notes de frais"), count: notes.filter((n) => n.status === "submitted").length },
          ]}
        />
      </div>

      {tab === "members" &&
        (!data.members.length ? (
          <Empty icon={Users} text={t("Ajoutez vos ouvriers : planning, pointage et espace ouvrier sur leur téléphone.")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.members.map((m) => (
              <button key={m.id} onClick={() => setEditing(m)} className={cn("card flex items-start gap-4 p-5 text-left", !m.active && "opacity-50")}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white" style={{ background: m.color }}>
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{m.name}</span>
                  <span className="block text-xs text-slate-400">
                    {t(ROLE[m.role])} · {m.lang.toUpperCase()} {m.pin ? "· PIN ✓" : ""}
                  </span>
                  <span className="mt-2 block text-xs text-slate-500">
                    {t("{h} h cette semaine", { h: f.num(hours(m.id), 1) })} · {f.money(m.hourlyCost)}/h
                  </span>
                </span>
              </button>
            ))}
          </div>
        ))}

      {tab === "hours" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setMonday(addDays(monday, -7))} className="btn-ghost !py-2 text-sm">←</button>
            <span className="text-sm font-semibold text-white">
              {f.date(days[0])} → {f.date(days[6])}
            </span>
            <button onClick={() => setMonday(addDays(monday, 7))} className="btn-ghost !py-2 text-sm">→</button>
            <span className="flex-1" />
            <button onClick={exportHours} className="btn-ghost !py-2 text-sm">
              <Download className="h-4 w-4" /> {t("Export pour le secrétariat social")}
            </button>
            <button onClick={() => setTime("new")} className="btn-primary !py-2 text-sm">
              <Clock className="h-4 w-4" /> {t("Encoder des heures")}
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3 text-left">{t("Membre")}</th>
                  {days.map((d) => (
                    <th key={d} className="p-3 text-right">
                      {new Date(`${d}T12:00`).toLocaleDateString(f.locale, { weekday: "short", day: "numeric" })}
                    </th>
                  ))}
                  <th className="p-3 text-right">{t("Total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td className="p-3 font-medium text-slate-200">{m.name}</td>
                    {days.map((d) => (
                      <td key={d} className="p-3 text-right tabular-nums text-slate-300">
                        {hours(m.id, d) ? f.num(hours(m.id, d), 2) : "—"}
                      </td>
                    ))}
                    <td className="p-3 text-right font-semibold tabular-nums text-white">{f.num(hours(m.id), 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
            {week.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <button onClick={() => setTime(e)} className="min-w-0 flex-1 text-left">
                  <span className="text-slate-200">{data.members.find((m) => m.id === e.memberId)?.name}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {f.date(e.date)} {e.start}–{e.end} · {data.jobs.find((j) => j.id === e.jobId)?.name}
                  </span>
                </button>
                <span className="tabular-nums text-white">{f.num(e.hours, 2)} h</span>
              </li>
            ))}
          </ul>
          <Notice>{t("Biltov enregistre les heures prestées ; le calcul des salaires reste chez votre secrétariat social.")}</Notice>
        </div>
      )}

      {tab === "expenses" &&
        (!notes.length ? (
          <Empty icon={Receipt} text={t("Aucune note de frais. Les ouvriers les encodent depuis leur espace (photo du ticket).")} />
        ) : (
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
            {notes.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => setExpense(e)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-slate-100">{e.label}</p>
                  <p className="truncate text-xs text-slate-500">
                    {data.members.find((m) => m.id === e.memberId)?.name ?? "—"} · {e.supplier} · {f.date(e.date)}
                  </p>
                </button>
                <span className="tabular-nums text-white">{f.money(e.amountTTC)}</span>
                <span className="text-xs text-slate-500">{f.money(expenseHt(e))} HTVA</span>
                <Badge label={t({ draft: "Brouillon", submitted: "À valider", approved: "Validée", reimbursed: "Remboursée" }[e.status])} style={e.status === "submitted" ? "bg-amber-400/15 text-amber-300" : e.status === "reimbursed" ? "bg-emerald/15 text-emerald" : "bg-white/10 text-slate-300"} />
                {e.status === "submitted" && (
                  <>
                    <button onClick={() => upsert("expenses", { ...e, status: "approved" })} className="btn-primary !px-3 !py-1.5 text-xs">
                      {t("Valider")}
                    </button>
                    <button onClick={() => upsert("expenses", { ...e, status: "draft" })} className="btn-ghost !px-3 !py-1.5 text-xs">
                      {t("Refuser")}
                    </button>
                  </>
                )}
                {e.status === "approved" && (
                  <button onClick={() => upsert("expenses", { ...e, status: "reimbursed" })} className="btn-ghost !px-3 !py-1.5 text-xs">
                    {t("Marquer remboursée")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}

      <AnimatePresence>
        {editing && <MemberForm member={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {time && <TimeForm entry={time === "new" ? null : time} onClose={() => setTime(null)} />}
        {expense && <ExpenseForm jobId={expense.jobId} expense={expense} onClose={() => setExpense(null)} />}
      </AnimatePresence>
    </div>
  );
}
