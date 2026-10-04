"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Clock, Crown, Download, Plus, Receipt, RotateCcw, ShieldCheck, Users } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { addDays, todayIso, uid } from "@/lib/app/defaults";
import { ROLE } from "@/lib/app/labels";
import { mondayOf, weekDays } from "@/lib/app/planning";
import { toCsv } from "@/lib/app/finance";
import { downloadBlob } from "@/lib/app/send";
import type { Access, AssignableRole, Expense, Member, PermModule, Permissions, Role, TimeEntry } from "@/lib/app/types";
import { ASSIGNABLE_ROLES, DEFAULT_PERMISSIONS, PERM_LABEL, PERM_MODULES, READ_ONLY_MODULES, ROLE_DESC, isSuperAdmin, rolePermissions } from "@/lib/app/permissions";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, SubTabs, Toggle, inputClass } from "./ui";
import { TimeForm } from "./FieldPanels";
import { ExpenseForm, expenseHt } from "./ExpensesPanel";

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const ACCESS_LABEL: Record<Access, string> = { none: "Aucun", read: "Lecture", edit: "Modification" };

/** Choix aucun / lecture / modification pour chaque module. `base` : droits du rôle (exceptions par personne). */
export function PermissionGrid({ value, base, onChange, disabled }: { value: Partial<Permissions>; base?: Permissions; onChange: (m: PermModule, a: Access | null) => void; disabled?: boolean }) {
  const { t } = useTr();
  return (
    <ul className="divide-y divide-white/5 rounded-2xl border border-white/10">
      {PERM_MODULES.map((m) => {
        const current = value[m] ?? base?.[m] ?? "none";
        const overridden = !!base && value[m] !== undefined && value[m] !== base[m];
        const options: Access[] = READ_ONLY_MODULES.includes(m) ? ["none", "read"] : ["none", "read", "edit"];
        return (
          <li key={m} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-100">
                {t(PERM_LABEL[m].label)} {overridden && <span className="ml-1 rounded bg-amber-400/15 px-1.5 text-[10px] font-bold uppercase text-amber-300">{t("personnalisé")}</span>}
              </span>
              <span className="block text-xs text-slate-500">{t(PERM_LABEL[m].desc)}</span>
            </span>
            <span className="flex items-center gap-2">
              <span role="radiogroup" aria-label={t(PERM_LABEL[m].label)} className="flex rounded-lg border border-white/10 p-0.5 text-xs font-semibold">
                {options.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={current === a}
                    disabled={disabled}
                    onClick={() => onChange(m, a)}
                    className={cn("rounded-md px-2.5 py-1.5 disabled:cursor-not-allowed", current === a ? (a === "none" ? "bg-rose-500/20 text-rose-200" : a === "read" ? "bg-sky-400/20 text-sky-200" : "bg-emerald/20 text-emerald") : "text-slate-500 hover:text-white")}
                  >
                    {t(ACCESS_LABEL[a])}
                  </button>
                ))}
              </span>
              {overridden && !disabled && (
                <button type="button" onClick={() => onChange(m, null)} className="text-xs text-cyan hover:underline">
                  {t("Comme le rôle")}
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function MemberForm({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert, remove, actor } = useAppData();
  const superAdmin = isSuperAdmin(actor);
  const [m, setM] = useState<Member>(member ?? { id: uid(), name: "", role: "worker", phone: "", email: "", lang: data.company.lang, hourlyCost: 35, color: COLORS[data.members.length % COLORS.length], pin: "", active: true, permissions: null });
  const [custom, setCustom] = useState(!!member?.permissions && Object.keys(member.permissions).length > 0);
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setM((x) => ({ ...x, [k]: v }));
  const isOwner = m.role === "owner";
  const pinOk = isOwner ? !m.pin || /^\d{4,6}$/.test(m.pin) : /^\d{4,6}$/.test(m.pin);
  const pinTaken = !!m.pin && data.members.some((x) => x.id !== m.id && x.active && x.pin === m.pin);
  const base = isOwner ? null : rolePermissions(data.settings, m.role as AssignableRole);
  return (
    <Modal
      wide={!isOwner}
      title={member ? t("Modifier l'utilisateur") : t("Nouvel utilisateur")}
      onClose={onClose}
      footer={
        <>
          {member && superAdmin && !isOwner && (
            <button onClick={() => window.confirm(t("Supprimer {n} ? Son historique (heures, rapports) est conservé.", { n: m.name })) && (remove("members", m.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!m.name.trim() || !pinOk || pinTaken} onClick={() => (upsert("members", { ...m, permissions: custom && m.permissions && Object.keys(m.permissions).length ? m.permissions : null }), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("Nom")} *`}>
            <input className={inputClass} value={m.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("Rôle")} hint={t(ROLE_DESC[m.role])}>
            {isOwner ? (
              <p className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-sm font-semibold text-amber-200">
                <Crown className="h-4 w-4" /> {t("Super admin")}
              </p>
            ) : (
              <select disabled={!superAdmin} className={inputClass} value={m.role} onChange={(e) => set("role", e.target.value as Role)}>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(ROLE[r])}
                  </option>
                ))}
              </select>
            )}
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
          {!isOwner && (
            <Field label={`${t("Code PIN de connexion (4 à 6 chiffres)")} *`} error={(m.pin && !pinOk && t("4 à 6 chiffres.")) || (pinTaken && t("Ce code est déjà utilisé par un autre utilisateur."))} hint={t("Pour se connecter sur un appareil de l'entreprise.")}>
              <input disabled={!superAdmin} inputMode="numeric" type={superAdmin ? "text" : "password"} className={inputClass} value={m.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} />
            </Field>
          )}
          <Field label={t("Couleur au planning")}>
            <div className="flex gap-2 pt-1">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => set("color", c)} className={cn("h-7 w-7 rounded-full", m.color === c && "ring-2 ring-white ring-offset-2 ring-offset-ink")} style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </Field>
          {!isOwner && (
            <div className="sm:col-span-2">
              <Toggle checked={m.active} onChange={(v) => set("active", v)} label={t("Actif")} hint={t("Un utilisateur inactif ne peut plus se connecter et n'apparaît plus au planning.")} />
            </div>
          )}
        </div>
        {isOwner && <Notice>{t("Le rôle de super admin appartient au titulaire du compte. Il ne peut être ni supprimé ni attribué à quelqu'un d'autre.")}</Notice>}
        {base && (
          <div className="space-y-3">
            <Toggle
              checked={custom}
              onChange={(v) => {
                if (!superAdmin) return;
                setCustom(v);
                if (!v) set("permissions", null);
              }}
              label={t("Accès personnalisés pour cette personne")}
              hint={superAdmin ? t("Sinon, elle reçoit les droits de son rôle ({r}).", { r: t(ROLE[m.role]) }) : t("Réservé au super admin.")}
            />
            {custom && (
              <PermissionGrid
                value={m.permissions ?? {}}
                base={base}
                disabled={!superAdmin}
                onChange={(mod, a) => {
                  const next = { ...(m.permissions ?? {}) };
                  if (a === null || a === base[mod]) delete next[mod];
                  else next[mod] = a;
                  set("permissions", next);
                }}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function RolesPanel() {
  const { t } = useTr();
  const { data, update } = useAppData();
  const [role, setRole] = useState<AssignableRole>("admin");
  const perms = rolePermissions(data.settings, role);
  const customised = !!data.settings.rolePermissions?.[role] && Object.keys(data.settings.rolePermissions[role]!).length > 0;
  const setAccess = (m: PermModule, a: Access | null) =>
    update((d) => {
      const all = { ...(d.settings.rolePermissions ?? {}) };
      const cur = { ...(all[role] ?? {}) };
      if (a === null || a === DEFAULT_PERMISSIONS[role][m]) delete cur[m];
      else cur[m] = a;
      all[role] = cur;
      return { ...d, settings: { ...d.settings, rolePermissions: all } };
    });
  return (
    <div className="space-y-4">
      <Notice>{t("Choisissez ce que chaque rôle peut voir (lecture) ou modifier. Les menus sont masqués et toute modification non autorisée est refusée. Vous pouvez aussi donner des accès personnalisés à une personne depuis sa fiche.")}</Notice>
      <div className="flex flex-wrap gap-2">
        {ASSIGNABLE_ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", role === r ? "border-cyan/60 bg-cyan/10 text-white" : "border-white/10 text-slate-400 hover:text-white")}>
            {t(ROLE[r])} <span className="text-xs font-normal text-slate-500">({data.members.filter((x) => x.role === r).length})</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-400">{t(ROLE_DESC[role])}</p>
      <PermissionGrid value={perms} onChange={(m, a) => setAccess(m, a)} />
      {customised && (
        <button onClick={() => update((d) => ({ ...d, settings: { ...d.settings, rolePermissions: { ...(d.settings.rolePermissions ?? {}), [role]: {} } } }))} className="btn-ghost !py-2 text-sm">
          <RotateCcw className="h-4 w-4" /> {t("Rétablir les droits par défaut de ce rôle")}
        </button>
      )}
    </div>
  );
}

export function TeamTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert, actor, account, can } = useAppData();
  const superAdmin = isSuperAdmin(actor);
  const [tab, setTab] = useState<"members" | "hours" | "expenses" | "roles">(can("team") ? "members" : "hours");
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
          superAdmin && (
            <button onClick={() => setEditing("new")} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Nouvel utilisateur")}
            </button>
          )
        }
      />
      <div className="mb-6">
        <SubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            ...(can("team") ? [{ id: "members" as const, label: t("Utilisateurs"), count: data.members.length }] : []),
            ...(can("time") ? [{ id: "hours" as const, label: t("Heures de la semaine") }] : []),
            ...(can("team") ? [{ id: "expenses" as const, label: t("Notes de frais"), count: notes.filter((n) => n.status === "submitted").length }] : []),
            ...(superAdmin ? [{ id: "roles" as const, label: t("Rôles et accès") }] : []),
          ]}
        />
      </div>

      {tab === "roles" && superAdmin && <RolesPanel />}

      {tab === "members" && !data.members.some((m) => m.role === "owner") && (
        <div className="card mb-4 flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
            <Crown className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-white">{data.company.owner || account?.email}</span>
            <span className="block text-xs text-slate-400">
              {t("Super admin")} · {account?.email}
            </span>
          </span>
          <ShieldCheck className="h-5 w-5 text-amber-300" />
        </div>
      )}

      {tab === "members" &&
        (!data.members.length ? (
          <Empty icon={Users} text={t("Ajoutez vos ouvriers : planning, pointage et espace ouvrier sur leur téléphone.")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.members.map((m) => (
              <button key={m.id} onClick={() => setEditing(m)} className={cn("card flex items-start gap-4 p-5 text-left", !m.active && "opacity-50")}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold text-white theme-fixed" style={{ background: m.color }}>
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{m.name}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                    {t(ROLE[m.role])} · {m.lang.toUpperCase()} {m.pin ? "· PIN ✓" : ""} {m.permissions && Object.keys(m.permissions).length > 0 && `· ${t("accès personnalisés")}`}
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
