"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Mic, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { newClient, newJob } from "@/lib/app/defaults";
import { audit, createQuote } from "@/lib/app/ops";
import { dictationToLines } from "@/lib/app/catalog/dictation";
import { JOB_STATUS, JOB_STATUSES, VAT_LABEL } from "@/lib/app/labels";
import { decideVat, housingAge, legal } from "@/lib/tax/belgium";
import type { Job, Line } from "@/lib/app/types";
import { Field, Modal, Notice, Toggle, inputClass } from "./ui";
import { VoiceInput } from "./VoiceInput";
import { ClientForm } from "./ClientForm";

export function JobForm({ job, clientId, onClose, onSaved }: { job: Job | null; clientId?: string; onClose: () => void; onSaved: (job: Job, quoteId?: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { t: land } = useI18n();
  const { data, update, run } = useAppData();
  const [draft, setDraft] = useState<Job>(job ?? newJob({ clientId: clientId ?? "", trade: data.company.trade }));
  const [lines, setLines] = useState<Line[]>([]);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [clientForm, setClientForm] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const set = <K extends keyof Job>(k: K, v: Job[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const client = data.clients.find((c) => c.id === draft.clientId);
  const ctx = { date: new Date().toISOString().slice(0, 10), companyRegime: data.company.vatRegime, clientKind: client?.kind ?? "particulier", workKind: draft.workKind, privateHousing: draft.privateHousing, firstOccupationYear: draft.firstOccupationYear };
  const labourVat = decideVat(ctx, "labour");
  const age = housingAge(ctx);

  const submit = () => {
    setShowErrors(true);
    if (!draft.name.trim() || (!draft.clientId && !newClientName)) return;
    let clientIdFinal = draft.clientId;
    if (!clientIdFinal && newClientName) {
      const c = newClient({ name: newClientName, lang: data.company.lang });
      clientIdFinal = c.id;
      update((d) => ({ ...d, clients: [c, ...d.clients] }));
    }
    const saved = { ...draft, clientId: clientIdFinal, name: draft.name.trim() };
    update((d) => audit({ ...d, jobs: d.jobs.some((j) => j.id === saved.id) ? d.jobs.map((j) => (j.id === saved.id ? saved : j)) : [saved, ...d.jobs] }, job ? "update" : "create", "job", saved.id, saved.name));
    const quote = !job && lines.length ? run((d) => createQuote(d, saved.id, lines)) : undefined;
    onSaved(saved, quote?.id);
  };

  return (
    <Modal
      title={job ? t("Modifier le chantier") : t("Nouveau chantier")}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={submit} className="btn-primary text-sm">
            {!job && lines.length ? t("Créer le chantier et le devis") : t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {!job && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan">
              <Mic className="h-3.5 w-3.5" /> {t("Dictez le chantier : Biltov trouve le client et prépare le devis avec vos prix")}
            </p>
            <VoiceInput
              onResult={(r, text) => {
                const found = r.client ? data.clients.find((c) => c.name.toLowerCase().includes(r.client!.toLowerCase().replace(/^(mme|m\.|mr|mevrouw|meneer|frau|herr|herrn)\s+/i, ""))) : undefined;
                setDraft((d) => ({ ...d, clientId: found?.id ?? d.clientId, name: d.name || (r.lines[0] ? `${r.lines[0].label}${r.client ? ` — ${r.client}` : ""}` : d.name), notes: d.notes || text }));
                if (!found && r.client && !draft.clientId) setNewClientName(r.client);
                const cl = found ?? client;
                setLines(dictationToLines(r, data.articles, cl?.lang ?? data.company.lang, data.settings.priceLists.find((p) => p.id === cl?.priceListId)));
              }}
            />
            {lines.length > 0 && (
              <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-slate-200">
                      {l.label}
                      {l.toPrice ? <span className="ml-2 rounded bg-amber-400/15 px-1.5 text-[10px] text-amber-300">{t("à chiffrer")}</span> : l.confidence !== null && l.confidence > 0 ? <span className="ml-2 text-[10px] text-emerald">{t("catalogue")} {Math.round(l.confidence * 100)} %</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {l.qty} {l.unit} × {f.money(l.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t("Client")} *`} error={showErrors && !draft.clientId && !newClientName && t("Obligatoire")}>
            <div className="flex gap-2">
              <select
                className={inputClass}
                value={draft.clientId || (newClientName ? "__new" : "")}
                onChange={(e) => {
                  if (e.target.value === "__form") return setClientForm(true);
                  setNewClientName(null);
                  set("clientId", e.target.value);
                }}
              >
                <option value="">— {t("Choisir")} —</option>
                {newClientName && <option value="__new">{t("Nouveau")} : {newClientName}</option>}
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__form">+ {t("Créer un client…")}</option>
              </select>
              <button type="button" onClick={() => setClientForm(true)} className="btn-ghost !px-3" aria-label={t("Nouveau client")}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Field>
          <Field label={`${t("Nom du chantier")} *`} error={showErrors && !draft.name.trim() && t("Obligatoire")}>
            <input className={inputClass} value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("Métier")}>
            <select className={inputClass} value={draft.trade} onChange={(e) => set("trade", e.target.value as Job["trade"])}>
              {land.trades.list.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Statut")}>
            <select className={inputClass} value={draft.status} onChange={(e) => set("status", e.target.value as Job["status"])}>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(JOB_STATUS[s].label)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Adresse du chantier")}>
            <select className={inputClass} value={draft.siteId ?? ""} onChange={(e) => set("siteId", e.target.value || null)}>
              <option value="">{t("Adresse de facturation du client")}</option>
              {client?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.street} — {s.city}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Ou adresse libre")}>
            <input className={inputClass} value={draft.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
          </Field>
        </div>

        <fieldset className="space-y-4 rounded-2xl border border-white/10 p-4">
          <legend className="px-2 font-display text-base font-bold text-white">{t("Questions TVA (Belgique)")}</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("Nature")}>
              <select className={inputClass} value={draft.workKind} onChange={(e) => set("workKind", e.target.value as Job["workKind"])}>
                <option value="immobilier">{t("Travaux immobiliers")}</option>
                <option value="livraison">{t("Simple livraison de biens")}</option>
              </select>
            </Field>
            <Field label={t("Année de première occupation du bâtiment")} hint={age !== null ? t("{n} an(s) d'ancienneté fiscale", { n: age }) : t("Inconnue → 21 %")}>
              <input type="number" className={inputClass} value={draft.firstOccupationYear ?? ""} onChange={(e) => set("firstOccupationYear", e.target.value ? Number(e.target.value) : null)} placeholder="1985" />
            </Field>
            <div className="pt-6">
              <Toggle checked={draft.privateHousing} onChange={(v) => set("privateHousing", v)} label={t("Logement privé (exclusivement ou principalement)")} />
            </div>
          </div>
          <Notice tone={labourVat.code === "6" ? "ok" : "info"}>
            {t("Taux proposé pour la main-d'œuvre")} : <strong>{t(VAT_LABEL[labourVat.code])}</strong> — {t(labourVat.reason)}
            {labourVat.warning && <span className="block text-amber-300">{t(labourVat.warning)}</span>}
            <span className="mt-1 block text-xs opacity-70">{t("Seuil : {n} ans. Vous pourrez confirmer ou modifier chaque ligne dans le devis.", { n: legal("vat.renovation6.minAgeYears") })}</span>
          </Notice>
          {client?.kind === "particulier" && <Toggle checked={draft.offPremises} onChange={(v) => set("offPremises", v)} label={t("Devis signé au domicile du client (hors établissement)")} hint={t("Ajoute l'information sur le droit de rétractation de 14 jours au devis.")} />}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label={t("Début")}>
            <input type="date" className={inputClass} value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label={t("Fin prévue")}>
            <input type="date" className={inputClass} value={draft.endDate} min={draft.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
          </Field>
          <Field label={t("Fin contractuelle")} hint={t("Date promise au client (pénalités de retard).")}>
            <input type="date" className={inputClass} value={draft.contractEndDate ?? ""} min={draft.startDate || undefined} onChange={(e) => set("contractEndDate", e.target.value || null)} />
          </Field>
          <Field label={t("Responsable")}>
            <select className={inputClass} value={draft.managerId ?? ""} onChange={(e) => set("managerId", e.target.value || null)}>
              <option value="">—</option>
              {data.members
                .filter((m) => m.active && m.role !== "accountant")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("Probabilité de signature (%)")}>
            <input type="number" min={0} max={100} className={inputClass} value={draft.probability} onChange={(e) => set("probability", Math.max(0, Math.min(100, e.target.valueAsNumber || 0)))} />
          </Field>
          <Field label={t("Commercial")}>
            <input className={inputClass} value={draft.salesRep} onChange={(e) => set("salesRep", e.target.value)} />
          </Field>
          <Field label={t("Équipe")} className="sm:col-span-4">
            <div className="flex flex-wrap gap-2">
              {data.members.filter((m) => m.active).map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-200">
                  <input type="checkbox" className="accent-emerald-500" checked={draft.memberIds.includes(m.id)} onChange={(e) => set("memberIds", e.target.checked ? [...draft.memberIds, m.id] : draft.memberIds.filter((x) => x !== m.id))} />
                  {m.name}
                </label>
              ))}
              {!data.members.length && <span className="text-xs text-slate-500">{t("Ajoutez votre équipe dans l'onglet Équipe.")}</span>}
            </div>
          </Field>
          <Field label={t("Notes internes")} className="sm:col-span-4">
            <textarea className={`${inputClass} resize-y`} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <Toggle checked={draft.weatherSensitive} onChange={(v) => set("weatherSensitive", v)} label={t("Travaux extérieurs (alerte météo dans le planning)")} />
      </div>
      <AnimatePresence>
        {clientForm && (
          <ClientForm
            client={newClientName ? newClient({ name: newClientName }) : null}
            onClose={() => setClientForm(false)}
            onSaved={(c) => {
              setNewClientName(null);
              set("clientId", c.id);
            }}
          />
        )}
      </AnimatePresence>
    </Modal>
  );
}
