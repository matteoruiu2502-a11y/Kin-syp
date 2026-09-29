"use client";

import { useState } from "react";
import { CheckCircle2, DatabaseBackup, FileCog, LogOut, Upload } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { missingCompanyFields } from "@/lib/app/legal";
import { downloadBlob } from "@/lib/app/send";
import { idbGet } from "@/lib/app/db";
import { todayIso } from "@/lib/app/defaults";
import { VAT_RATES, type AccountData, type VatRate } from "@/lib/app/types";
import { CompanyForm } from "./CompanyForm";
import { BrandingForm } from "./BrandingForm";
import { Field, Notice, Toggle, inputClass } from "./ui";

export function SettingsTab() {
  const { data, account, updateCompany, updateBranding, updateSettings, logOut } = useAppData();
  const [company, setCompany] = useState(data.company);
  const [branding, setBranding] = useState(data.branding);
  const [settings, setSettings] = useState(data.settings);
  const [saved, setSaved] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const missing = missingCompanyFields(company);

  const save = () => {
    setShowErrors(true);
    updateCompany(company);
    updateBranding(branding);
    updateSettings({ ...settings, counters: data.settings.counters });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const backup = async () => {
    const photos: Record<string, string> = {};
    const toData = (b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(f.result as string); f.readAsDataURL(b); });
    for (const p of data.photos) {
      const b = await idbGet<Blob>(`photo:${p.id}`);
      if (b) photos[`photo:${p.id}`] = await toData(b);
    }
    for (const e of data.expenses)
      if (e.receiptId) {
        const b = await idbGet<Blob>(`receipt:${e.receiptId}`);
        if (b) photos[`receipt:${e.receiptId}`] = await toData(b);
      }
    downloadBlob(new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data, files: photos })], { type: "application/json" }), `biltov-sauvegarde-${todayIso()}.json`);
  };

  const n = (k: keyof typeof settings, v: number) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Paramètres</h1>
          <p className="mt-1 text-sm text-slate-400">Ces informations alimentent automatiquement vos devis, factures et relances.</p>
        </div>
        <button onClick={save} className="btn-primary text-sm">
          {saved ? <CheckCircle2 className="h-4 w-4" /> : null} {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>
      {showErrors && missing.length > 0 && <Notice tone="warn">Certaines mentions obligatoires manquent encore : vous ne pourrez pas envoyer de devis ni émettre de facture tant qu&apos;elles ne sont pas complétées.</Notice>}

      <div className="card space-y-10 p-6 sm:p-8">
        <CompanyForm value={company} onChange={setCompany} showErrors={showErrors} />
        <BrandingForm value={branding} onChange={setBranding} />

        <section className="space-y-4">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <FileCog className="h-4 w-4 text-cyan" /> Devis &amp; factures
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Validité des devis (jours)">
              <input type="number" min={1} className={inputClass} value={settings.quoteValidityDays} onChange={(e) => n("quoteValidityDays", e.target.valueAsNumber || 30)} />
            </Field>
            <Field label="Délai de paiement (jours)" hint="60 jours maximum entre professionnels (art. L441-10)">
              <input type="number" min={0} max={60} className={inputClass} value={settings.paymentTermsDays} onChange={(e) => n("paymentTermsDays", Math.min(60, e.target.valueAsNumber || 0))} />
            </Field>
            <Field label="Acompte par défaut (%)">
              <input type="number" min={0} max={100} className={inputClass} value={settings.depositPercent} onChange={(e) => n("depositPercent", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label="TVA par défaut (logement > 2 ans)">
              <select className={inputClass} value={settings.defaultVat} onChange={(e) => setSettings((s) => ({ ...s, defaultVat: Number(e.target.value) as VatRate }))}>
                {VAT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r.toLocaleString("fr-FR")} %
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Préfixe des devis">
              <input className={inputClass} value={settings.quotePrefix} onChange={(e) => setSettings((s) => ({ ...s, quotePrefix: e.target.value.toUpperCase().slice(0, 4) }))} />
            </Field>
            <Field label="Préfixe des factures" hint="La numérotation reste continue par année">
              <input className={inputClass} value={settings.invoicePrefix} onChange={(e) => setSettings((s) => ({ ...s, invoicePrefix: e.target.value.toUpperCase().slice(0, 4) }))} />
            </Field>
          </div>
          <Toggle checked={settings.freeQuote} onChange={(v) => setSettings((s) => ({ ...s, freeQuote: v }))} label="Devis gratuits" hint="Mention « Devis gratuit » ou « Devis payant » sur chaque devis." />
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-white">
            <DatabaseBackup className="h-4 w-4 text-cyan" /> Compte &amp; sauvegarde
          </h3>
          <p className="text-sm text-slate-400">
            Connecté avec <strong className="text-slate-200">{account?.email}</strong>. Vos données sont enregistrées sur cet appareil : téléchargez régulièrement une sauvegarde (factures à conserver 10 ans).
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={backup} className="btn-ghost text-sm">
              <DatabaseBackup className="h-4 w-4" /> Télécharger une sauvegarde complète
            </button>
            <RestoreButton />
            <button onClick={logOut} className="btn-ghost text-sm text-rose-300">
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function RestoreButton() {
  const { account } = useAppData();
  return (
    <label className="btn-ghost cursor-pointer text-sm">
      <Upload className="h-4 w-4" /> Restaurer
      <input
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !account) return;
          if (!window.confirm("Remplacer toutes les données de ce compte par celles de la sauvegarde ?")) return;
          const { data, files } = JSON.parse(await file.text()) as { data: AccountData; files: Record<string, string> };
          const { idbSet } = await import("@/lib/app/db");
          for (const [key, url] of Object.entries(files ?? {})) await idbSet(key, await (await fetch(url)).blob());
          await idbSet(`data:${account.id}`, data);
          window.location.reload();
        }}
      />
    </label>
  );
}
