"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Archive, Copy, Download, Layers, Package, Percent, Plus, Trash2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { applyArticlePlan, ARTICLE_FIELDS, articleTemplate, planArticleImport, workbookBlob } from "@/lib/app/catalog/import";
import { bulkAdjust, computedSale, costOf, indexArticles, recalcAll, saleOf } from "@/lib/app/catalog/pricing";
import { searchArticles } from "@/lib/app/catalog/match";
import { newArticle, todayIso, uid } from "@/lib/app/defaults";
import { ARTICLE_TYPE, CATEGORY, UNITS } from "@/lib/app/labels";
import { downloadBlob } from "@/lib/app/send";
import type { Article, ArticleType, LineCategory } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { DataTable, Empty, Field, Modal, Notice, PageHeader, SearchBox, Toggle, inputClass } from "./ui";
import { ImportWizard } from "./ImportWizard";

export function ArticleForm({ article, onClose }: { article: Article | null; onClose: () => void }) {
  const { t } = useTr();
  const { t: land } = useI18n();
  const f = useFmt();
  const { data, update } = useAppData();
  const [a, setA] = useState<Article>(article ?? newArticle({ trade: data.company.trade }));
  const [pick, setPick] = useState("");
  const set = <K extends keyof Article>(k: K, v: Article[K]) => setA((x) => ({ ...x, [k]: v }));
  const idx = useMemo(() => indexArticles([...data.articles.filter((x) => x.id !== a.id), a]), [data.articles, a]);
  const isPackage = a.type === "package" || a.components.length > 0;
  const cost = costOf(a, idx);
  const sale = saleOf(a, idx);
  const others = data.articles.filter((x) => x.id !== a.id && x.active);

  const save = () => {
    if (!a.name.fr.trim()) return;
    const hist = article && (article.purchasePrice !== a.purchasePrice || article.salePrice !== a.salePrice) ? [...a.priceHistory, { at: todayIso(), purchase: article.purchasePrice, sale: article.salePrice }] : a.priceHistory;
    const saved = { ...a, priceHistory: hist };
    update((d) => ({ ...d, articles: recalcAll(d.articles.some((x) => x.id === saved.id) ? d.articles.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...d.articles]) }));
    onClose();
  };

  return (
    <Modal
      title={article ? t("Modifier l'article") : t("Nouvel article ou ouvrage")}
      onClose={onClose}
      wide
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button onClick={save} disabled={!a.name.fr.trim()} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Référence")}>
            <input className={inputClass} value={a.ref} onChange={(e) => set("ref", e.target.value)} />
          </Field>
          <Field label={t("Type")}>
            <select className={inputClass} value={a.type} onChange={(e) => set("type", e.target.value as ArticleType)}>
              {(Object.keys(ARTICLE_TYPE) as ArticleType[]).map((k) => (
                <option key={k} value={k}>
                  {t(ARTICLE_TYPE[k])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Unité")}>
            <select className={inputClass} value={a.unit} onChange={(e) => set("unit", e.target.value)}>
              {[...new Set([...UNITS, a.unit])].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
          <Field label={`${t("Désignation")} FR *`} className="sm:col-span-3">
            <input className={inputClass} value={a.name.fr} onChange={(e) => set("name", { ...a.name, fr: e.target.value })} />
          </Field>
          <Field label={`${t("Désignation")} NL`} className="sm:col-span-3 lg:col-span-1">
            <input className={inputClass} value={a.name.nl} onChange={(e) => set("name", { ...a.name, nl: e.target.value })} />
          </Field>
          <Field label={`${t("Désignation")} DE`} className="sm:col-span-3 lg:col-span-1">
            <input className={inputClass} value={a.name.de} onChange={(e) => set("name", { ...a.name, de: e.target.value })} />
          </Field>
          <Field label={t("Famille")} className="sm:col-span-3 lg:col-span-1">
            <input className={inputClass} value={a.family} list="families" onChange={(e) => set("family", e.target.value)} />
            <datalist id="families">
              {[...new Set(data.articles.map((x) => x.family).filter(Boolean))].map((fam) => (
                <option key={fam} value={fam} />
              ))}
            </datalist>
          </Field>
          <Field label={t("Métier")}>
            <select className={inputClass} value={a.trade} onChange={(e) => set("trade", e.target.value as Article["trade"])}>
              <option value="">{t("Tous")}</option>
              {land.trades.list.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Nature (pour la TVA)")} hint={t("Le moteur de TVA choisit le taux selon la nature et le chantier.")}>
            <select className={inputClass} value={a.category} onChange={(e) => set("category", e.target.value as LineCategory)}>
              {(Object.keys(CATEGORY) as LineCategory[]).map((k) => (
                <option key={k} value={k}>
                  {t(CATEGORY[k])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Fournisseur")}>
            <select className={inputClass} value={a.supplierId ?? ""} onChange={(e) => set("supplierId", e.target.value || null)}>
              <option value="">—</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {!isPackage ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={t("Prix d'achat HTVA")}>
              <input type="number" step="0.01" className={inputClass} value={a.purchasePrice} onChange={(e) => set("purchasePrice", e.target.valueAsNumber || 0)} />
            </Field>
            <Field label={t("Marge %")}>
              <input type="number" step="0.1" className={inputClass} value={a.marginPercent} onChange={(e) => setA((x) => ({ ...x, marginPercent: e.target.valueAsNumber || 0, salePriceForced: false }))} />
            </Field>
            <Field label={t("Prix de vente HTVA")} hint={a.salePriceForced ? t("Prix forcé") : t("Calculé : {p}", { p: f.money(computedSale(a)) })}>
              <input type="number" step="0.01" className={inputClass} value={a.salePriceForced ? a.salePrice : computedSale(a)} onChange={(e) => setA((x) => ({ ...x, salePrice: e.target.valueAsNumber || 0, salePriceForced: true }))} />
            </Field>
            <Field label={t("Stock minimum")}>
              <input type="number" className={inputClass} value={a.minStock} onChange={(e) => set("minStock", e.target.valueAsNumber || 0)} />
            </Field>
          </div>
        ) : (
          <section className="space-y-3 rounded-2xl border border-white/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="h-4 w-4 text-cyan" /> {t("Composition de l'ouvrage (pour 1 {u})", { u: a.unit })}
            </p>
            {a.components.map((c, i) => {
              const comp = idx.get(c.articleId);
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-200">{comp?.name.fr ?? "?"}</span>
                  <input type="number" step="0.01" className={cn(inputClass, "!w-24 text-right")} value={c.qty} onChange={(e) => set("components", a.components.map((x, k) => (k === i ? { ...x, qty: e.target.valueAsNumber || 0 } : x)))} />
                  <span className="w-10 text-slate-500">{comp?.unit}</span>
                  <span className="w-24 text-right tabular-nums text-slate-400">{f.money((comp ? saleOf(comp, idx) : 0) * c.qty)}</span>
                  <button onClick={() => set("components", a.components.filter((_, k) => k !== i))} className="p-1 text-slate-500 hover:text-rose-400" aria-label={t("Supprimer")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <select
              className={inputClass}
              value={pick}
              onChange={(e) => {
                if (e.target.value) set("components", [...a.components, { articleId: e.target.value, qty: 1 }]);
                setPick("");
              }}
            >
              <option value="">+ {t("Ajouter un composant")}</option>
              {others.filter((o) => o.type !== "package").map((o) => (
                <option key={o.id} value={o.id}>
                  {o.ref ? `${o.ref} — ` : ""}
                  {o.name.fr} ({f.money(o.salePrice)}/{o.unit})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap justify-end gap-6 text-sm">
              <span className="text-slate-400">
                {t("Prix de revient")} <strong className="text-white">{f.money(cost)}</strong>
              </span>
              <span className="text-slate-400">
                {t("Prix de vente")} <strong className="text-white">{f.money(sale)}</strong>
              </span>
              <span className="text-slate-400">
                {t("Marge")} <strong className="text-emerald">{sale ? Math.round(((sale - cost) / sale) * 100) : 0} %</strong>
              </span>
            </div>
            <Toggle checked={a.salePriceForced} onChange={(v) => setA((x) => ({ ...x, salePriceForced: v, salePrice: v ? sale : x.salePrice }))} label={t("Forcer le prix de vente de l'ouvrage")} />
            {a.salePriceForced && <input type="number" step="0.01" className={inputClass} value={a.salePrice} onChange={(e) => set("salePrice", e.target.valueAsNumber || 0)} />}
          </section>
        )}
        {a.type !== "package" && !a.components.length && (
          <button onClick={() => set("type", "package")} className="text-xs text-cyan underline">
            {t("Transformer en ouvrage composé")}
          </button>
        )}

        <Field label={t("Ouvrages liés (suggérés à l'insertion dans un devis)")}>
          <div className="flex flex-wrap gap-2">
            {a.related.map((id) => (
              <span key={id} className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-200">
                {idx.get(id)?.name.fr}
                <button onClick={() => set("related", a.related.filter((x) => x !== id))} aria-label={t("Retirer")}>
                  ×
                </button>
              </span>
            ))}
            <select className={cn(inputClass, "!w-auto")} value="" onChange={(e) => e.target.value && set("related", [...new Set([...a.related, e.target.value])])}>
              <option value="">+ {t("Lier")}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name.fr}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Réf. fournisseur")}>
            <input className={inputClass} value={a.supplierRef} onChange={(e) => set("supplierRef", e.target.value)} />
          </Field>
          <Field label="EAN">
            <input className={inputClass} value={a.ean} onChange={(e) => set("ean", e.target.value)} />
          </Field>
          <Field label={t("Statut")}>
            <select className={inputClass} value={a.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
              <option value="1">{t("Actif")}</option>
              <option value="0">{t("Archivé")}</option>
            </select>
          </Field>
          <Field label={t("Description / notes internes")} className="sm:col-span-3">
            <textarea className={cn(inputClass, "resize-y")} rows={2} value={a.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        {a.priceHistory.length > 0 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">{t("Historique des prix")}</summary>
            <ul className="mt-2 space-y-1">
              {[...a.priceHistory].reverse().map((h, i) => (
                <li key={i}>
                  {f.date(h.at)} — {t("achat")} {f.money(h.purchase)} · {t("vente")} {f.money(h.sale)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  );
}

export function CatalogTab() {
  const { t } = useTr();
  const { t: land } = useI18n();
  const f = useFmt();
  const { data, update } = useAppData();
  const [q, setQ] = useState("");
  const [family, setFamily] = useState("all");
  const [type, setType] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState({ key: "name", dir: "asc" as "asc" | "desc" });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Article | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importSupplier, setImportSupplier] = useState<string>("");
  const [margin, setMargin] = useState(30);
  const [bulk, setBulk] = useState(false);
  const [pct, setPct] = useState(5);

  const families = [...new Set(data.articles.map((a) => a.family).filter(Boolean))].sort();
  const rows = useMemo(() => {
    const base = data.articles.filter((a) => (showArchived || a.active) && (family === "all" || a.family === family) && (type === "all" || a.type === type) && (supplier === "all" || a.supplierId === supplier));
    return q.trim() ? searchArticles(q, base) : base;
  }, [data.articles, q, family, type, supplier, showArchived]);

  const exportXlsx = async () =>
    downloadBlob(
      await workbookBlob([{ name: "Catalogue", headers: ARTICLE_FIELDS.map((x) => x.label), rows: data.articles.map((a) => [a.ref, a.name.fr, a.name.nl, a.name.de, a.family, a.unit, a.purchasePrice, a.marginPercent, a.salePrice, t(ARTICLE_TYPE[a.type]), a.supplierRef, a.ean, t(CATEGORY[a.category])]) }]),
      `biltov-catalogue-${todayIso()}.xlsx`,
    );

  const toggle = (id: string) => setSel((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const supplierRow = data.suppliers.find((s) => s.id === importSupplier);

  return (
    <div>
      <PageHeader
        title={t("Catalogue")}
        subtitle={t("{n} article(s) et ouvrage(s)", { n: data.articles.filter((a) => a.active).length })}
        actions={
          <>
            <button onClick={() => setImporting(true)} className="btn-ghost !py-2.5 text-sm">
              <Upload className="h-4 w-4" /> {t("Importer Excel / CSV")}
            </button>
            <button onClick={exportXlsx} className="btn-ghost !py-2.5 text-sm">
              <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={() => setEditing("new")} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Nouvel article")}
            </button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher (FR, NL, DE, référence)…")} />
        <select className={inputClass} value={family} onChange={(e) => setFamily(e.target.value)} aria-label={t("Famille")}>
          <option value="all">{t("Toutes les familles")}</option>
          {families.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)} aria-label={t("Type")}>
          <option value="all">{t("Tous les types")}</option>
          {Object.entries(ARTICLE_TYPE).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
        <select className={inputClass} value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label={t("Fournisseur")}>
          <option value="all">{t("Tous les fournisseurs")}</option>
          {data.suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-emerald-500" /> {t("Archivés")}
        </label>
      </div>

      {sel.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/5 px-4 py-2 text-sm">
          <span className="text-cyan">{t("{n} sélectionné(s)", { n: sel.size })}</span>
          <button onClick={() => setBulk(true)} className="btn-ghost !px-3 !py-1.5 text-xs">
            <Percent className="h-3.5 w-3.5" /> {t("Hausse / baisse de prix")}
          </button>
          <select
            className={cn(inputClass, "!w-auto !py-1.5 text-xs")}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              update((d) => ({ ...d, articles: d.articles.map((a) => (sel.has(a.id) ? { ...a, category: v as LineCategory } : a)) }));
            }}
          >
            <option value="">{t("Changer la nature TVA…")}</option>
            {Object.entries(CATEGORY).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
          <input
            className={cn(inputClass, "!w-40 !py-1.5 text-xs")}
            placeholder={t("Nouvelle famille…")}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const v = (e.target as HTMLInputElement).value;
              update((d) => ({ ...d, articles: d.articles.map((a) => (sel.has(a.id) ? { ...a, family: v } : a)) }));
            }}
          />
          <button onClick={() => update((d) => ({ ...d, articles: d.articles.map((a) => (sel.has(a.id) ? { ...a, active: !a.active } : a)) }))} className="btn-ghost !px-3 !py-1.5 text-xs">
            <Archive className="h-3.5 w-3.5" /> {t("Archiver / réactiver")}
          </button>
          <button
            onClick={() => {
              const dups = data.articles.filter((a) => sel.has(a.id)).map((a) => ({ ...a, id: uid(), ref: a.ref ? `${a.ref}-COPIE` : "", name: { ...a.name, fr: `${a.name.fr} (copie)` }, priceHistory: [] }));
              update((d) => ({ ...d, articles: [...dups, ...d.articles] }));
              setSel(new Set());
            }}
            className="btn-ghost !px-3 !py-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" /> {t("Dupliquer")}
          </button>
          <button onClick={() => setSel(new Set())} className="ml-auto text-xs text-slate-400 underline">
            {t("Désélectionner")}
          </button>
        </div>
      )}

      {data.articles.length === 0 ? (
        <Empty icon={Package} text={t("Catalogue vide. Importez le fichier de prix de votre fournisseur ou ajoutez vos articles.")} />
      ) : (
        <DataTable
          rows={rows}
          onRow={(a) => setEditing(a)}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
          cols={[
            { key: "sel", label: "", render: (a) => <input type="checkbox" checked={sel.has(a.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(a.id)} className="accent-emerald-500" aria-label={t("Sélectionner")} /> },
            { key: "ref", label: t("Réf."), sort: (a) => a.ref, render: (a) => <span className="font-mono text-xs text-slate-400">{a.ref}</span> },
            {
              key: "name",
              label: t("Désignation"),
              sort: (a) => a.name.fr,
              render: (a) => (
                <span className={cn("text-slate-100", !a.active && "line-through opacity-60")}>
                  {a.type === "package" && <Layers className="mr-1 inline h-3.5 w-3.5 text-cyan" />}
                  {a.name.fr}
                  {a.name.nl && <span className="block text-xs text-slate-500">{a.name.nl}</span>}
                </span>
              ),
            },
            { key: "family", label: t("Famille"), sort: (a) => a.family, render: (a) => <span className="text-slate-400">{a.family}</span> },
            { key: "unit", label: t("Unité"), render: (a) => <span className="text-slate-400">{a.unit}</span> },
            { key: "cost", label: t("Achat"), sort: (a) => a.purchasePrice, render: (a) => <span className="tabular-nums text-slate-400">{f.money(a.purchasePrice)}</span>, className: "text-right" },
            { key: "price", label: t("Vente HTVA"), sort: (a) => a.salePrice, render: (a) => <span className="font-semibold tabular-nums">{f.money(a.salePrice)}</span>, className: "text-right" },
            { key: "margin", label: t("Marge"), sort: (a) => (a.salePrice ? (a.salePrice - a.purchasePrice) / a.salePrice : 0), render: (a) => <span className="tabular-nums text-emerald">{a.salePrice ? Math.round(((a.salePrice - a.purchasePrice) / a.salePrice) * 100) : 0} %</span>, className: "text-right" },
            { key: "trade", label: t("Métier"), sort: (a) => a.trade, render: (a) => <span className="text-xs text-slate-500">{land.trades.list.find((x) => x.id === a.trade)?.name ?? ""}</span> },
          ]}
          empty={t("Aucun article ne correspond.")}
        />
      )}

      <AnimatePresence>
        {editing && <ArticleForm article={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {bulk && (
          <Modal
            title={t("Hausse / baisse de prix")}
            onClose={() => setBulk(false)}
            footer={
              <>
                <button onClick={() => setBulk(false)} className="btn-ghost text-sm">
                  {t("Annuler")}
                </button>
                <button
                  onClick={() => {
                    update((d) => ({ ...d, articles: bulkAdjust(d.articles, sel, pct) }));
                    setBulk(false);
                    setSel(new Set());
                  }}
                  className="btn-primary text-sm"
                >
                  {t("Appliquer")}
                </button>
              </>
            }
          >
            <Field label={t("Variation du prix d'achat (%)")} hint={t("Le prix de vente est recalculé selon la marge ; les ouvrages sont mis à jour.")}>
              <input type="number" step="0.5" className={inputClass} value={pct} onChange={(e) => setPct(e.target.valueAsNumber || 0)} />
            </Field>
          </Modal>
        )}
        {importing && (
          <ImportWizard
            title={t("Importer des articles")}
            fields={ARTICLE_FIELDS}
            template={articleTemplate}
            remembered={supplierRow?.importMapping}
            onRemember={(m) => importSupplier && update((d) => ({ ...d, suppliers: d.suppliers.map((s) => (s.id === importSupplier ? { ...s, importMapping: m } : s)) }))}
            onClose={() => setImporting(false)}
            extra={
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("Fournisseur (mémorise l'association des colonnes)")}>
                  <select className={inputClass} value={importSupplier} onChange={(e) => setImportSupplier(e.target.value)}>
                    <option value="">—</option>
                    {data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Marge par défaut si absente (%)")}>
                  <input type="number" className={inputClass} value={margin} onChange={(e) => setMargin(e.target.valueAsNumber || 0)} />
                </Field>
                <div className="sm:col-span-2">
                  <Notice>{t("Réimporter le fichier de prix d'un fournisseur met à jour les prix d'achat et recalcule les prix de vente selon vos marges (historique conservé).")}</Notice>
                </div>
              </div>
            }
            plan={(parsed, dup) => {
              const p = planArticleImport(parsed, data.articles, { duplicates: dup, supplierId: importSupplier || null, defaultMargin: margin, trade: data.company.trade });
              return {
                create: p.create.length,
                update: p.update.length,
                skipped: p.skipped,
                preview: [...p.create, ...p.update].map((a) => ({ label: `${a.ref ? `${a.ref} — ` : ""}${a.name.fr}`, detail: `${f.money(a.purchasePrice)} → ${f.money(a.salePriceForced ? a.salePrice : computedSale(a))} / ${a.unit}` })),
                apply: () => update((d) => ({ ...d, articles: applyArticlePlan(d.articles, p) })),
              };
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
