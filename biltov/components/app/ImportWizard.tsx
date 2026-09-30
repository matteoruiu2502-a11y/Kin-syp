"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { autoMap, errorReportCsv, readTable, validateRows, type DuplicateMode, type FieldDef, type Parsed, type Table } from "@/lib/app/catalog/import";
import { downloadBlob } from "@/lib/app/send";
import { useTr } from "@/lib/app/tr";
import { cn } from "@/lib/utils";
import { Field, Modal, Notice, inputClass } from "./ui";

export type PlanSummary = { create: number; update: number; skipped: number; apply: () => void; preview?: { label: string; detail: string }[] };

/** Assistant d'import en 3 étapes : fichier → colonnes → simulation / confirmation. */
export function ImportWizard({
  title,
  fields,
  remembered,
  onRemember,
  plan,
  template,
  extra,
  onClose,
}: {
  title: string;
  fields: FieldDef[];
  remembered?: Record<string, string> | null;
  onRemember?: (mapping: Record<string, string>) => void;
  plan: (parsed: Parsed[], duplicates: DuplicateMode) => PlanSummary;
  template?: () => Promise<Blob>;
  extra?: React.ReactNode;
  onClose: () => void;
}) {
  const { t } = useTr();
  const [table, setTable] = useState<Table | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [dup, setDup] = useState<DuplicateMode>("update");
  const [done, setDone] = useState<PlanSummary | null>(null);

  const load = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const tb = await readTable(file);
      if (!tb.headers.length || !tb.rows.length) throw new Error(t("Le fichier est vide ou sans ligne d'en-tête."));
      setTable(tb);
      setFileName(file.name);
      setMapping(autoMap(tb.headers, fields, remembered));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const validation = useMemo(() => (table ? validateRows(table, mapping, fields) : null), [table, mapping, fields]);
  const summary = useMemo(() => (validation ? plan(validation.parsed, dup) : null), [validation, dup, plan]);
  const missingRequired = fields.filter((f) => f.required && !Object.values(mapping).includes(f.key));

  const confirm = () => {
    if (!summary) return;
    summary.apply();
    onRemember?.(mapping);
    setDone(summary);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        done ? (
          <button onClick={onClose} className="btn-primary text-sm">
            {t("Terminer")}
          </button>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost text-sm">
              {t("Annuler")}
            </button>
            <button onClick={confirm} disabled={!summary || missingRequired.length > 0 || summary.create + summary.update === 0} className="btn-primary text-sm disabled:opacity-40">
              {summary ? t("Importer ({n} lignes)", { n: summary.create + summary.update }) : t("Importer")}
            </button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald" />
          <p className="text-lg font-semibold text-white">{t("Import terminé")}</p>
          <p className="text-sm text-slate-400">{t("{c} créé(s), {u} mis à jour, {s} ignoré(s).", { c: done.create, u: done.update, s: done.skipped })}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {!table && (
            <>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void load(f);
                }}
                className={cn("flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors", drag ? "border-cyan bg-cyan/5" : "border-white/15 hover:border-cyan/50")}
              >
                {busy ? <Loader2 className="h-10 w-10 animate-spin text-cyan" /> : <Upload className="h-10 w-10 text-cyan" />}
                <span className="font-semibold text-white">{t("Glissez votre fichier ici ou cliquez pour choisir")}</span>
                <span className="text-xs text-slate-500">.xlsx, .csv — {t("UTF-8 ou Windows-1252, séparateur « ; » ou « , », virgule décimale acceptée")}</span>
                <input type="file" accept=".xlsx,.xlsm,.csv,.txt,.xls" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
              </label>
              {template && (
                <button onClick={async () => downloadBlob(await template(), "modele-import-biltov.xlsx")} className="btn-ghost text-sm">
                  <Download className="h-4 w-4" /> {t("Télécharger le modèle Excel")}
                </button>
              )}
              {error && <Notice tone="danger">{error}</Notice>}
            </>
          )}

          {table && validation && summary && (
            <>
              <p className="flex items-center gap-2 text-sm text-slate-300">
                <FileSpreadsheet className="h-4 w-4 text-cyan" /> {fileName} — {t("{n} ligne(s)", { n: table.rows.length })}
                <button onClick={() => setTable(null)} className="ml-2 text-xs text-slate-500 underline">
                  {t("Changer de fichier")}
                </button>
              </p>
              {extra}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Association des colonnes")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {table.headers.map((h, i) => (
                    <label key={`${h}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-200" title={h}>
                        {h || `${t("Colonne")} ${i + 1}`}
                        <span className="block truncate text-xs text-slate-500">{table.rows[0]?.[i]}</span>
                      </span>
                      <select className={cn(inputClass, "!w-48")} value={mapping[h] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}>
                        <option value="">— {t("Ignorer")} —</option>
                        {fields.map((f) => (
                          <option key={f.key} value={f.key} disabled={Object.entries(mapping).some(([hh, k]) => k === f.key && hh !== h)}>
                            {t(f.label)}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {missingRequired.length > 0 && <p className="mt-2 text-xs text-rose-400">{t("Colonne obligatoire non associée")} : {missingRequired.map((f) => t(f.label)).join(", ")}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-emerald/30 bg-emerald/10 p-3">
                    <p className="font-display text-2xl font-bold text-emerald">{summary.create}</p>
                    <p className="text-xs text-slate-400">{t("à créer")}</p>
                  </div>
                  <div className="rounded-xl border border-blue/30 bg-blue/10 p-3">
                    <p className="font-display text-2xl font-bold text-sky-300">{summary.update}</p>
                    <p className="text-xs text-slate-400">{t("à mettre à jour")}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="font-display text-2xl font-bold text-slate-300">{summary.skipped + validation.errors.length}</p>
                    <p className="text-xs text-slate-400">{t("ignorées / en erreur")}</p>
                  </div>
                </div>
                <Field label={t("Doublons (même référence)")}>
                  <select className={inputClass} value={dup} onChange={(e) => setDup(e.target.value as DuplicateMode)}>
                    <option value="update">{t("Mettre à jour l'existant")}</option>
                    <option value="skip">{t("Ignorer")}</option>
                    <option value="create">{t("Créer un nouvel élément")}</option>
                  </select>
                </Field>
              </div>
              <p className="text-xs text-slate-500">{t("Simulation : rien n'est modifié tant que vous n'avez pas cliqué sur « Importer ».")}</p>

              {summary.preview && summary.preview.length > 0 && (
                <ul className="max-h-48 divide-y divide-white/5 overflow-y-auto rounded-xl border border-white/10 text-sm">
                  {summary.preview.slice(0, 50).map((p, i) => (
                    <li key={i} className="flex justify-between gap-4 px-3 py-2">
                      <span className="truncate text-slate-200">{p.label}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{p.detail}</span>
                    </li>
                  ))}
                </ul>
              )}

              {validation.errors.length > 0 && (
                <Notice tone="warn">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> {t("{n} erreur(s) : ces lignes ne seront pas importées.", { n: validation.errors.length })}
                    </span>
                    <button onClick={() => downloadBlob(new Blob([errorReportCsv(validation.errors)], { type: "text/csv;charset=utf-8" }), "rapport-erreurs-import.csv")} className="underline">
                      {t("Télécharger le rapport d'erreurs")}
                    </button>
                  </span>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {validation.errors.slice(0, 6).map((e, i) => (
                      <li key={i}>
                        {t("Ligne")} {e.row} — {t(e.field)} : {e.message}
                      </li>
                    ))}
                  </ul>
                </Notice>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
