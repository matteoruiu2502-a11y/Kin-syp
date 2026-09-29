"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { newJob, uid } from "@/lib/app/defaults";
import { JOB_STATUS, JOB_STATUSES } from "@/lib/app/labels";
import { isSiren } from "@/lib/app/legal";
import type { Job, Line } from "@/lib/app/types";
import { Field, Modal, Toggle, inputClass } from "./ui";
import { VoiceInput } from "./VoiceInput";

/** Création / modification d'un chantier. En création, la dictée prépare aussi le devis. */
export function JobForm({ job, onClose, onSaved }: { job: Job | null; onClose: () => void; onSaved: (job: Job, quoteId?: string) => void }) {
  const { t } = useI18n();
  const { data, saveJob, createQuote } = useAppData();
  const [draft, setDraft] = useState<Job>(job ?? newJob({ trade: data.company.trade }));
  const [lines, setLines] = useState<Line[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const set = <K extends keyof Job>(k: K, v: Job[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const pro = draft.clientType === "professionnel";
  const errors = {
    name: !draft.name.trim() && "Obligatoire",
    client: !draft.client.trim() && "Obligatoire",
    clientAddress: !draft.clientAddress.trim() && "Obligatoire (mention légale du devis)",
    clientSiren: pro && draft.clientSiren.trim() !== "" && !isSiren(draft.clientSiren) && "SIREN invalide (9 chiffres)",
  };

  const submit = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    const saved = { ...draft, name: draft.name.trim(), client: draft.client.trim() };
    saveJob(saved);
    const quote = !job && lines.length ? createQuote(saved.id, lines) : undefined;
    onSaved(saved, quote?.id);
  };

  return (
    <Modal
      title={job ? "Modifier le chantier" : "Nouveau chantier"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Annuler
          </button>
          <button type="button" onClick={submit} className="btn-primary text-sm">
            {!job && lines.length ? "Créer le chantier et le devis" : "Enregistrer"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {!job && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan">
              <Mic className="h-3.5 w-3.5" /> Dictez le chantier : Biltov remplit le client et prépare le devis
            </p>
            <VoiceInput
              onResult={(r, text) => {
                setDraft((d) => ({
                  ...d,
                  client: r.client ?? d.client,
                  name: d.name || (r.lines[0] ? `${r.lines[0].label}${r.client ? ` — ${r.client}` : ""}` : d.name),
                  notes: d.notes || text,
                  amount: r.lines.reduce((s, l) => s + l.qty * l.price, 0),
                }));
                setLines(r.lines.map((l) => ({ id: uid(), label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.price, vat: data.settings.defaultVat })));
              }}
            />
            {lines.length > 0 && (
              <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
                {lines.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-slate-200">{l.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {l.qty} {l.unit} × {l.unitPrice} €
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du chantier *" error={showErrors && errors.name} className="sm:col-span-2">
            <input className={inputClass} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Salle de bain Durand" />
          </Field>
          <Field label="Métier">
            <select className={inputClass} value={draft.trade} onChange={(e) => set("trade", e.target.value as Job["trade"])}>
              {t.trades.list.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className={inputClass} value={draft.status} onChange={(e) => set("status", e.target.value as Job["status"])}>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-base font-bold text-white">Client</legend>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 p-1">
            {(["particulier", "professionnel"] as const).map((ct) => (
              <button key={ct} type="button" onClick={() => set("clientType", ct)} className={`rounded-lg py-2 text-sm font-semibold ${draft.clientType === ct ? "bg-gradient-to-r from-blue/50 to-emerald/40 text-white" : "text-slate-400"}`}>
                {ct === "particulier" ? "Particulier" : "Professionnel"}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pro ? "Raison sociale *" : "Nom et prénom *"} error={showErrors && errors.client}>
              <input className={inputClass} value={draft.client} onChange={(e) => set("client", e.target.value)} />
            </Field>
            {pro ? (
              <Field label="SIREN du client" error={showErrors && errors.clientSiren} hint="Mention exigée sur les factures entre professionnels">
                <input className={inputClass} value={draft.clientSiren} onChange={(e) => set("clientSiren", e.target.value)} inputMode="numeric" />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Adresse du client *" error={showErrors && errors.clientAddress} className="sm:col-span-2">
              <input className={inputClass} value={draft.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} placeholder="8 avenue Foch, 69006 Lyon" />
            </Field>
            <Field label="E-mail">
              <input className={inputClass} type="email" value={draft.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
            </Field>
            <Field label="Téléphone (WhatsApp / SMS)">
              <input className={inputClass} type="tel" value={draft.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="06 12 34 56 78" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="mb-3 font-display text-base font-bold text-white">Chantier</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse du chantier" hint="Si différente de l'adresse du client" className="sm:col-span-2">
              <input className={inputClass} value={draft.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
            </Field>
            <Field label="Ville">
              <input className={inputClass} value={draft.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Début prévu des travaux">
              <input className={inputClass} type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </Field>
            <Field label="Durée estimée">
              <input className={inputClass} value={draft.duration} onChange={(e) => set("duration", e.target.value)} placeholder="3 jours" />
            </Field>
            <Field label="Notes internes" className="sm:col-span-2">
              <textarea className={`${inputClass} resize-none`} rows={2} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-2">
            {!pro && (
              <Toggle
                checked={draft.offPremises}
                onChange={(v) => set("offPremises", v)}
                label="Contrat conclu hors établissement (chez le client, démarchage)"
                hint="Ajoute le droit de rétractation de 14 jours sur le devis (Code de la consommation)."
              />
            )}
            <Toggle
              checked={draft.reducedVatEligible}
              onChange={(v) => set("reducedVatEligible", v)}
              label="Logement achevé depuis plus de 2 ans (TVA 10 % / 5,5 %)"
              hint="Propose les taux réduits et ajoute l'attestation du client sur le devis."
            />
            {pro && (
              <Toggle checked={draft.reverseCharge} onChange={(v) => set("reverseCharge", v)} label="Sous-traitance BTP : autoliquidation de la TVA" hint="Facture HT avec la mention de l'article 283-2 nonies du CGI." />
            )}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
