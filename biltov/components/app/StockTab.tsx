"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowLeftRight, Boxes, ClipboardList, Plus, Warehouse } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { todayIso, uid } from "@/lib/app/defaults";
import { round2 } from "@/lib/app/money";
import type { AccountData, StockLocation, StockMove } from "@/lib/app/types";
import { Empty, Field, Modal, Notice, PageHeader, SearchBox, Stat, SubTabs, inputClass } from "./ui";

export const stockLevel = (d: AccountData, articleId: string, locationId?: string) => round2(d.stockMoves.filter((m) => m.articleId === articleId && (!locationId || m.locationId === locationId)).reduce((s, m) => s + m.qty, 0));

type MoveKind = "in" | "out" | "transfer" | "count";

function MoveForm({ kind, articleId, onClose }: { kind: MoveKind; articleId?: string; onClose: () => void }) {
  const { t } = useTr();
  const { data, update } = useAppData();
  const [art, setArt] = useState(articleId ?? "");
  const [loc, setLoc] = useState(data.stockLocations[0]?.id ?? "");
  const [to, setTo] = useState(data.stockLocations[1]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [job, setJob] = useState("");
  const current = art && loc ? stockLevel(data, art, loc) : 0;
  const titles: Record<MoveKind, string> = { in: "Entrée en stock", out: "Sortie vers un chantier", transfer: "Transfert (dépôt ↔ camionnette)", count: "Inventaire" };
  const save = () => {
    const base = { articleId: art, date: todayIso(), jobId: job || null };
    const moves: StockMove[] =
      kind === "in"
        ? [{ ...base, id: uid(), locationId: loc, qty, reason: t("Réception") }]
        : kind === "out"
          ? [{ ...base, id: uid(), locationId: loc, qty: -qty, reason: t("Sortie chantier") }]
          : kind === "transfer"
            ? [
                { ...base, id: uid(), locationId: loc, qty: -qty, reason: t("Transfert") },
                { ...base, id: uid(), locationId: to, qty, reason: t("Transfert") },
              ]
            : [{ ...base, id: uid(), locationId: loc, qty: round2(qty - current), reason: t("Inventaire") }];
    update((d) => ({ ...d, stockMoves: [...d.stockMoves, ...moves.filter((m) => m.qty !== 0)] }));
    onClose();
  };
  return (
    <Modal
      title={t(titles[kind])}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!art || !loc || (kind === "transfer" && (!to || to === loc)) || (kind !== "count" && qty <= 0)} onClick={save} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Article")} className="sm:col-span-2">
          <select className={inputClass} value={art} onChange={(e) => setArt(e.target.value)}>
            <option value="">—</option>
            {data.articles
              .filter((a) => a.active && (a.type === "supply" || a.type === "equipment"))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ref ? `${a.ref} — ` : ""}
                  {a.name.fr}
                </option>
              ))}
          </select>
        </Field>
        <Field label={kind === "transfer" ? t("De") : t("Emplacement")} hint={art && loc ? t("En stock : {q}", { q: current }) : undefined}>
          <select className={inputClass} value={loc} onChange={(e) => setLoc(e.target.value)}>
            {data.stockLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        {kind === "transfer" && (
          <Field label={t("Vers")}>
            <select className={inputClass} value={to} onChange={(e) => setTo(e.target.value)}>
              {data.stockLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={kind === "count" ? t("Quantité comptée") : t("Quantité")}>
          <input type="number" step="0.01" className={inputClass} value={qty} onChange={(e) => setQty(e.target.valueAsNumber || 0)} />
        </Field>
        {kind === "out" && (
          <Field label={t("Chantier")}>
            <select className={inputClass} value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">—</option>
              {data.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

function LocationForm({ onClose }: { onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert } = useAppData();
  const [l, setL] = useState<StockLocation>({ id: uid(), name: "", kind: "depot", vehicleId: null });
  return (
    <Modal
      title={t("Nouvel emplacement")}
      onClose={onClose}
      footer={
        <button disabled={!l.name.trim()} onClick={() => (upsert("stockLocations", l), onClose())} className="btn-primary text-sm disabled:opacity-40">
          {t("Enregistrer")}
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Nom")}>
          <input className={inputClass} value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} />
        </Field>
        <Field label={t("Type")}>
          <select className={inputClass} value={l.kind} onChange={(e) => setL({ ...l, kind: e.target.value as StockLocation["kind"] })}>
            <option value="depot">{t("Dépôt")}</option>
            <option value="vehicle">{t("Camionnette")}</option>
          </select>
        </Field>
        {l.kind === "vehicle" && (
          <Field label={t("Véhicule")}>
            <select className={inputClass} value={l.vehicleId ?? ""} onChange={(e) => setL({ ...l, vehicleId: e.target.value || null, name: l.name || data.vehicles.find((v) => v.id === e.target.value)?.plate || "" })}>
              <option value="">—</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.model}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function StockTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, upsert } = useAppData();
  const [tab, setTab] = useState<"levels" | "moves">("levels");
  const [move, setMove] = useState<{ kind: MoveKind; articleId?: string } | null>(null);
  const [location, setLocation] = useState(false);
  const [q, setQ] = useState("");
  const tracked = data.articles.filter((a) => a.active && (a.type === "supply" || a.type === "equipment"));
  const rows = tracked
    .map((a) => ({ a, total: stockLevel(data, a.id), per: data.stockLocations.map((l) => stockLevel(data, a.id, l.id)) }))
    .filter((r) => r.total !== 0 || r.a.minStock > 0 || data.stockMoves.some((m) => m.articleId === r.a.id))
    .filter((r) => !q || `${r.a.ref} ${r.a.name.fr}`.toLowerCase().includes(q.toLowerCase()));
  const low = rows.filter((r) => r.a.minStock > 0 && r.total < r.a.minStock);
  const value = round2(rows.reduce((s, r) => s + Math.max(0, r.total) * r.a.purchasePrice, 0));

  if (!data.stockLocations.length)
    return (
      <div>
        <PageHeader title={t("Stock")} />
        <Empty icon={Warehouse} text={t("Créez votre dépôt pour suivre le stock (et vos camionnettes).")} action={<button onClick={() => upsert("stockLocations", { id: "depot", name: t("Dépôt"), kind: "depot", vehicleId: null })} className="btn-primary text-sm"><Plus className="h-4 w-4" /> {t("Créer le dépôt")}</button>} />
      </div>
    );

  return (
    <div>
      <PageHeader
        title={t("Stock")}
        subtitle={t("{n} emplacement(s)", { n: data.stockLocations.length })}
        actions={
          <>
            <button onClick={() => setLocation(true)} className="btn-ghost !py-2.5 text-sm">
              <Warehouse className="h-4 w-4" /> {t("Emplacement")}
            </button>
            <button onClick={() => setMove({ kind: "count" })} className="btn-ghost !py-2.5 text-sm">
              <ClipboardList className="h-4 w-4" /> {t("Inventaire")}
            </button>
            <button onClick={() => setMove({ kind: "transfer" })} className="btn-ghost !py-2.5 text-sm">
              <ArrowLeftRight className="h-4 w-4" /> {t("Transfert")}
            </button>
            <button onClick={() => setMove({ kind: "in" })} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Entrée")}
            </button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label={t("Valeur du stock (prix d'achat)")} value={f.money0(value)} />
        <Stat label={t("Articles suivis")} value={String(rows.length)} />
        <Stat label={t("Sous le minimum")} value={String(low.length)} tone={low.length ? "warn" : "ok"} />
      </div>
      {low.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            <AlertTriangle className="mr-1 inline h-4 w-4" />
            {t("À réapprovisionner")} : {low.map((r) => `${r.a.name.fr} (${r.total}/${r.a.minStock})`).join(" · ")}
          </Notice>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SubTabs value={tab} onChange={setTab} tabs={[{ id: "levels", label: t("Niveaux") }, { id: "moves", label: t("Mouvements"), count: data.stockMoves.length }]} />
        <div className="min-w-[220px] flex-1">
          <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher un article…")} />
        </div>
      </div>
      {tab === "levels" ? (
        !rows.length ? (
          <Empty icon={Boxes} text={t("Aucun mouvement. Réceptionnez une commande fournisseur ou encodez une entrée.")} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3 text-left">{t("Article")}</th>
                  {data.stockLocations.map((l) => (
                    <th key={l.id} className="p-3 text-right">
                      {l.name}
                    </th>
                  ))}
                  <th className="p-3 text-right">{t("Total")}</th>
                  <th className="p-3 text-right">{t("Min.")}</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((r) => (
                  <tr key={r.a.id}>
                    <td className="p-3">
                      <span className="block text-slate-100">{r.a.name.fr}</span>
                      <span className="text-xs text-slate-500">
                        {r.a.ref} · {r.a.unit}
                      </span>
                    </td>
                    {r.per.map((v, i) => (
                      <td key={i} className="p-3 text-right tabular-nums text-slate-300">
                        {v || "—"}
                      </td>
                    ))}
                    <td className={`p-3 text-right font-semibold tabular-nums ${r.a.minStock > 0 && r.total < r.a.minStock ? "text-amber-300" : "text-white"}`}>{r.total}</td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{r.a.minStock || "—"}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setMove({ kind: "out", articleId: r.a.id })} className="btn-ghost !px-2.5 !py-1 text-xs">
                        {t("Sortie")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {[...data.stockMoves]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-24 text-xs tabular-nums text-slate-500">{f.date(m.date)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-200">
                  {data.articles.find((a) => a.id === m.articleId)?.name.fr}
                  <span className="text-slate-500">
                    {" "}
                    · {data.stockLocations.find((l) => l.id === m.locationId)?.name} · {m.reason}
                    {m.jobId && ` · ${data.jobs.find((j) => j.id === m.jobId)?.name}`}
                  </span>
                </span>
                <span className={`tabular-nums font-semibold ${m.qty < 0 ? "text-rose-300" : "text-emerald"}`}>
                  {m.qty > 0 ? "+" : ""}
                  {m.qty}
                </span>
              </li>
            ))}
        </ul>
      )}
      <AnimatePresence>
        {move && <MoveForm kind={move.kind} articleId={move.articleId} onClose={() => setMove(null)} />}
        {location && <LocationForm onClose={() => setLocation(false)} />}
      </AnimatePresence>
    </div>
  );
}
