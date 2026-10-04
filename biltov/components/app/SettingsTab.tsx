"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Plus, Trash2, Upload } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { downloadBlob } from "@/lib/app/send";
import { todayIso, uid } from "@/lib/app/defaults";
import { LEGAL_TABLE, legalRow, type LegalKey } from "@/lib/tax/belgium";
import type { AccountData, Lang, Settings } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { CompanyForm, companyMissing } from "./CompanyForm";
import { BrandingForm } from "./BrandingForm";
import { Field, Notice, PageHeader, SubTabs, inputClass } from "./ui";

type Section = "company" | "documents" | "prices" | "reminders" | "legal" | "backup" | "audit";
const LANGS: Lang[] = ["fr", "nl", "de"];
const STEPS = ["1er rappel (gratuit pour les particuliers)", "Relance avec frais / intérêts", "Mise en demeure"];

export function SettingsTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, getBlob, putBlob, isDemo } = useAppData();
  const [section, setSection] = useState<Section>("company");
  const [company, setCompany] = useState(data.company);
  const [branding, setBranding] = useState(data.branding);
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [saved, setSaved] = useState(false);
  const [tplLang, setTplLang] = useState<Lang>("fr");
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const save = () => {
    update((d) => ({ ...d, company, branding, settings: { ...settings, counters: d.settings.counters, modules: d.settings.modules } }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const backup = async () => {
    const toData = (b: Blob) => new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result as string);
      fr.readAsDataURL(b);
    });
    const keys = [...data.photos.map((p) => `photo:${p.id}`), ...data.expenses.filter((e) => e.receiptId).map((e) => `receipt:${e.receiptId}`), ...data.records.filter((r) => r.module === "documents").map((r) => `file:${r.id}`)];
    const blobs: Record<string, string> = {};
    for (const k of keys) {
      const b = await getBlob(k);
      if (b) blobs[k] = await toData(b);
    }
    downloadBlob(new Blob([JSON.stringify({ app: "biltov", version: 2, exportedAt: new Date().toISOString(), data, blobs })], { type: "application/json" }), `biltov-sauvegarde-${todayIso()}.json`);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (json.app !== "biltov" || json.version !== 2 || !json.data?.company) throw new Error();
      if (!window.confirm(t("Remplacer toutes les données de ce compte par la sauvegarde ?"))) return;
      for (const [k, url] of Object.entries(json.blobs ?? {}) as [string, string][]) await putBlob(k, await (await fetch(url)).blob());
      update(() => json.data as AccountData);
      setMsg({ tone: "ok", text: t("Sauvegarde restaurée.") });
    } catch {
      setMsg({ tone: "danger", text: t("Fichier de sauvegarde Biltov invalide.") });
    }
  };

  const legalKeys = Object.keys(LEGAL_TABLE) as LegalKey[];

  return (
    <div>
      <PageHeader
        title={t("Paramètres")}
        actions={
          ["company", "documents", "prices", "reminders"].includes(section) && (
            <button onClick={save} className="btn-primary !py-2.5 text-sm">
              {saved ? <CheckCircle2 className="h-4 w-4" /> : null} {saved ? t("Enregistré") : t("Enregistrer")}
            </button>
          )
        }
      />
      <div className="mb-6">
        <SubTabs
          value={section}
          onChange={setSection}
          tabs={[
            { id: "company", label: t("Entreprise") },
            { id: "documents", label: t("Devis & factures") },
            { id: "prices", label: t("Listes de prix") },
            { id: "reminders", label: t("Relances") },
            { id: "legal", label: t("Valeurs légales") },
            { id: "backup", label: t("Sauvegarde") },
            { id: "audit", label: t("Journal") },
          ]}
        />
      </div>

      {section === "company" && (
        <div className="space-y-8">
          {companyMissing(company) && <Notice tone="warn">{t("Informations obligatoires manquantes : nom, responsable, adresse, e-mail, numéro BCE valide et IBAN valide.")}</Notice>}
          <CompanyForm value={company} onChange={setCompany} showErrors />
          <BrandingForm value={branding} onChange={setBranding} />
        </div>
      )}

      {section === "documents" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("Validité des devis (jours)")}>
              <input type="number" className={inputClass} value={settings.quoteValidityDays} onChange={(e) => set("quoteValidityDays", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label={t("Délai de paiement (jours)")}>
              <input type="number" className={inputClass} value={settings.paymentTermsDays} onChange={(e) => set("paymentTermsDays", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label={t("Acompte par défaut (%)")}>
              <input type="number" className={inputClass} value={settings.depositPercent} onChange={(e) => set("depositPercent", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label={t("Retenue de garantie par défaut (%)")}>
              <input type="number" className={inputClass} value={settings.retentionGuaranteePercent} onChange={(e) => set("retentionGuaranteePercent", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label={t("Marge par défaut — nos ouvriers (%)")} hint={t("Prix de vente = coût × (1 + marge).")}>
              <input type="number" step="0.5" className={inputClass} value={settings.defaultMargins.own} onChange={(e) => set("defaultMargins", { ...settings.defaultMargins, own: e.target.valueAsNumber || 0 })} />
            </Field>
            <Field label={t("Marge par défaut — sous-traitance (%)")} hint={t("Modifiable par sous-traitant et par ligne.")}>
              <input type="number" step="0.5" className={inputClass} value={settings.defaultMargins.subcontract} onChange={(e) => set("defaultMargins", { ...settings.defaultMargins, subcontract: e.target.valueAsNumber || 0 })} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Préfixes de numérotation")}</p>
            <div className="grid gap-4 sm:grid-cols-5">
              {(
                [
                  ["quote", "Devis"],
                  ["invoice", "Factures"],
                  ["credit", "Notes de crédit"],
                  ["proforma", "Pro forma"],
                  ["order", "Bons de commande"],
                ] as const
              ).map(([k, label]) => (
                <Field key={k} label={t(label)}>
                  <input className={inputClass} value={settings.prefixes[k]} onChange={(e) => set("prefixes", { ...settings.prefixes, [k]: e.target.value.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() })} />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t("Numérotation continue par année, sans trou : {ex}. Un numéro émis n'est jamais réutilisé.", { ex: `${settings.prefixes.invoice}-${new Date().getFullYear()}-0001` })}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label={t("Conditions générales — particuliers")} hint={t("Imprimées au verso des devis et factures. Texte de votre choix.")}>
              <textarea rows={8} className={inputClass} value={settings.terms.b2c} onChange={(e) => set("terms", { ...settings.terms, b2c: e.target.value })} />
            </Field>
            <Field label={t("Conditions générales — professionnels")}>
              <textarea rows={8} className={inputClass} value={settings.terms.b2b} onChange={(e) => set("terms", { ...settings.terms, b2b: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {section === "prices" && (
        <div className="space-y-4">
          <Notice>{t("Chaque client peut être rattaché à une liste de prix : remise générale et remises par famille d'articles appliquées automatiquement au devis.")}</Notice>
          {settings.priceLists.map((pl, i) => {
            const setPl = (patch: Partial<typeof pl>) => set("priceLists", settings.priceLists.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const families = [...new Set(data.articles.map((a) => a.family).filter(Boolean))];
            return (
              <div key={pl.id} className="card space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <Field label={t("Nom")}>
                    <input className={inputClass} value={pl.name} onChange={(e) => setPl({ name: e.target.value })} />
                  </Field>
                  <Field label={t("Remise générale (%)")}>
                    <input type="number" className={inputClass} value={pl.discountPercent} onChange={(e) => setPl({ discountPercent: e.target.valueAsNumber || 0 })} />
                  </Field>
                  {pl.id !== "default" && (
                    <button onClick={() => set("priceLists", settings.priceLists.filter((_, j) => j !== i))} className="btn-ghost !py-2.5 text-sm text-rose-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {families.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {families.map((fam) => (
                      <Field key={fam} label={`${fam} (%)`}>
                        <input type="number" className={inputClass} value={pl.familyDiscounts[fam] ?? ""} placeholder="—" onChange={(e) => setPl({ familyDiscounts: { ...pl.familyDiscounts, [fam]: e.target.valueAsNumber || 0 } })} />
                      </Field>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => set("priceLists", [...settings.priceLists, { id: uid(), name: t("Nouvelle liste"), discountPercent: 0, familyDiscounts: {} }])} className="btn-ghost text-sm">
            <Plus className="h-4 w-4" /> {t("Ajouter une liste de prix")}
          </button>
        </div>
      )}

      {section === "reminders" && (
        <div className="space-y-4">
          <Notice>
            {t("Variables : {client}, {numero}, {montant}, {montant_total}, {frais}, {echeance}, {iban}, {communication}, {mention_b2c}, {entreprise}, {bce}. Le message part dans la langue du client.")}
          </Notice>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button key={l} onClick={() => setTplLang(l)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", tplLang === l ? "bg-white/10 text-white" : "text-slate-400")}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {settings.reminderTemplates.map((tpl, i) => {
            const setTpl = (k: "subject" | "body", v: string) => set("reminderTemplates", settings.reminderTemplates.map((x, j) => (j === i ? { ...x, [k]: { ...x[k], [tplLang]: v } } : x)));
            return (
              <div key={i} className="card space-y-3 p-5">
                <p className="font-semibold text-white">{t(STEPS[i] ?? `#${i + 1}`)}</p>
                <Field label={t("Objet")}>
                  <input className={inputClass} value={tpl.subject[tplLang]} onChange={(e) => setTpl("subject", e.target.value)} />
                </Field>
                <Field label={t("Message")}>
                  <textarea rows={7} className={inputClass} value={tpl.body[tplLang]} onChange={(e) => setTpl("body", e.target.value)} />
                </Field>
              </div>
            );
          })}
        </div>
      )}

      {section === "legal" && (
        <div className="space-y-4">
          <Notice tone="warn">{t("Taux, seuils et délais utilisés par Biltov, avec leur date d'entrée en vigueur et leur source. Les valeurs marquées « à vérifier » doivent être confirmées par votre comptable.")}</Notice>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3">{t("Paramètre")}</th>
                  <th className="p-3">{t("Valeur")}</th>
                  <th className="p-3">{t("Depuis")}</th>
                  <th className="p-3">{t("Source")}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {legalKeys.map((k) => {
                  const r = legalRow(k);
                  const v = r.value;
                  return (
                    <tr key={k}>
                      <td className="p-3 font-mono text-xs text-cyan">{k}</td>
                      <td className="p-3 text-slate-200">{Array.isArray(v) ? (typeof v[0] === "object" ? t("barème ({n} tranches)", { n: v.length }) : v.join(" / ")) : String(v)}</td>
                      <td className="p-3 tabular-nums text-slate-400">{f.date(r.validFrom)}</td>
                      <td className="p-3 text-xs text-slate-400">{r.source}</td>
                      <td className="p-3">{r.verified ? <CheckCircle2 className="h-4 w-4 text-emerald" /> : <span className="flex items-center gap-1 text-xs text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> {t("à vérifier")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === "backup" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold text-white">
              <DatabaseBackup className="h-4 w-4 text-cyan" /> {t("Exporter une sauvegarde complète")}
            </p>
            <p className="text-sm text-slate-400">{t("Toutes vos données, photos, tickets et documents dans un seul fichier. Les données sont stockées sur cet appareil : sauvegardez régulièrement.")}</p>
            <button onClick={backup} className="btn-primary text-sm">
              {t("Télécharger la sauvegarde")}
            </button>
          </div>
          <div className="card space-y-3 p-5">
            <p className="flex items-center gap-2 font-semibold text-white">
              <Upload className="h-4 w-4 text-cyan" /> {t("Restaurer")}
            </p>
            <p className="text-sm text-slate-400">{t("Remplace les données de ce compte par celles d'une sauvegarde Biltov (changement d'appareil).")}</p>
            <label className="btn-ghost cursor-pointer text-sm">
              {t("Choisir le fichier")}
              <input type="file" accept="application/json,.json" className="sr-only" disabled={isDemo} onChange={(e) => restore(e.target.files?.[0])} />
            </label>
          </div>
          {msg && (
            <div className="sm:col-span-2">
              <Notice tone={msg.tone}>{msg.text}</Notice>
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="mb-3 text-xs text-slate-500">Biltov v {process.env.NEXT_PUBLIC_BUILD} UTC</p>
            <Notice>{t("Obligation de conservation : gardez vos factures et pièces pendant la durée légale. La synchronisation entre appareils et l'archivage à valeur probante nécessiteront le serveur.")}</Notice>
          </div>
        </div>
      )}

      {section === "audit" && (
        <div className="card overflow-hidden">
          <ul className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto text-sm">
            {[...data.audit].reverse().slice(0, 500).map((a, i) => (
              <li key={i} className="flex flex-wrap gap-3 px-4 py-2">
                <span className="w-40 tabular-nums text-xs text-slate-500">{new Date(a.at).toLocaleString(f.locale)}</span>
                <span className="text-slate-300">
                  {a.action} · {a.entity}
                </span>
                <span className="text-slate-500">{a.detail}</span>
              </li>
            ))}
            {!data.audit.length && <li className="p-4 text-slate-500">{t("Aucune action enregistrée.")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
