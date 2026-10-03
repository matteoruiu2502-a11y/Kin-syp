"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Ban, CheckCircle2, Landmark, Link2, Plus, RefreshCw, Undo2, Upload, XCircle } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { parseCoda } from "@/lib/app/coda";
import { applyMatches, importMoves, invoiceDue, openInvoicesFor, openPurchases, pontoProvider, purchaseDue, suggestMatches, unmatch } from "@/lib/app/bank";
import { isStructuredCommunication } from "@/lib/tax/belgium";
import { nowIso, todayIso, uid } from "@/lib/app/defaults";
import { round2 } from "@/lib/app/money";
import type { BankMatch, BankMove, BankMoveStatus } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, SearchBox, Stat, SubTabs, inputClass } from "./ui";

export const BANK_STATUS: Record<BankMoveStatus, { label: string; style: string }> = {
  unmatched: { label: "À lettrer", style: "bg-amber-400/10 text-amber-300 ring-amber-400/30" },
  matched: { label: "Lettré", style: "bg-emerald/10 text-emerald ring-emerald/30" },
  partial: { label: "Paiement partiel", style: "bg-blue/15 text-sky-300 ring-blue/30" },
  surplus: { label: "Surplus", style: "bg-violet-500/10 text-violet-300 ring-violet-500/30" },
  ignored: { label: "Ignoré", style: "bg-white/5 text-slate-400 ring-white/10" },
};

/** Lettrage manuel : répartir un mouvement sur une ou plusieurs factures. */
function MatchDialog({ move, onClose }: { move: BankMove; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update } = useAppData();
  const credit = move.amount > 0;
  const total = Math.abs(move.amount);
  const candidates = credit
    ? [...openInvoicesFor(data), ...data.docs.filter((x) => move.matches.some((m) => m.id === x.id) && !openInvoicesFor(data).includes(x))].map((x) => ({ id: x.id, label: `${x.number} — ${data.clients.find((c) => c.id === x.clientId)?.name ?? ""}`, due: invoiceDue(x) + (move.matches.find((m) => m.id === x.id)?.amount ?? 0) }))
    : [...openPurchases(data), ...data.purchases.filter((p) => move.matches.some((m) => m.id === p.id) && p.status === "paid")].map((p) => ({ id: p.id, label: `${p.number || "—"} — ${data.suppliers.find((s) => s.id === p.supplierId)?.name ?? ""}`, due: purchaseDue(p) }));
  const initial = move.matches.length ? move.matches : suggestMatches(data, move).matches;
  const [alloc, setAlloc] = useState<Record<string, number>>(Object.fromEntries(initial.map((m) => [m.id, m.amount])));
  const [q, setQ] = useState("");
  const allocated = round2(Object.values(alloc).reduce((s, v) => s + (v || 0), 0));
  const rest = round2(total - allocated);
  const shown = candidates.filter((c) => !q || c.label.toLowerCase().includes(q.toLowerCase()) || alloc[c.id]);

  return (
    <Modal
      wide
      title={credit ? t("Lettrer un encaissement") : t("Lettrer un paiement fournisseur")}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button
            disabled={rest < -0.005}
            onClick={() => {
              const matches: BankMatch[] = Object.entries(alloc)
                .filter(([, v]) => v > 0)
                .map(([id, amount]) => ({ kind: credit ? "invoice" : "purchase", id, amount: round2(amount) }));
              update((d) => applyMatches(d, move.id, matches));
              onClose();
            }}
            className="btn-primary text-sm disabled:opacity-40"
          >
            <Link2 className="h-4 w-4" /> {t("Lettrer")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t("Montant du mouvement")} value={f.money(total)} />
          <Stat label={t("Affecté")} value={f.money(allocated)} />
          <Stat label={rest >= 0 ? t("Non affecté (surplus)") : t("Dépassement")} value={f.money(Math.abs(rest))} tone={rest < -0.005 ? "danger" : rest > 0.005 ? "warn" : "ok"} />
        </div>
        <p className="text-xs text-slate-500">
          {move.counterparty} · {move.communication || "—"}
        </p>
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher une facture…")} />
        <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-2xl border border-white/10 text-sm">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-500"
                checked={!!alloc[c.id]}
                onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.checked ? round2(Math.max(0, Math.min(c.due, total - allocated))) : 0 }))}
              />
              <span className="min-w-0 flex-1 truncate text-slate-200">{c.label}</span>
              <span className="text-xs text-slate-500">
                {t("dû")} {f.money(c.due)}
              </span>
              <input type="number" step="0.01" className={cn(inputClass, "!w-32 !py-1.5 text-right")} value={alloc[c.id] || ""} onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.valueAsNumber || 0 }))} />
            </li>
          ))}
          {!shown.length && <li className="p-4 text-slate-500">{t("Aucune facture ouverte.")}</li>}
        </ul>
      </div>
    </Modal>
  );
}

function ManualMove({ onClose }: { onClose: () => void }) {
  const { t } = useTr();
  const { update } = useAppData();
  const [m, setM] = useState({ date: todayIso(), amount: 0, communication: "", counterparty: "" });
  return (
    <Modal
      title={t("Ajouter un mouvement")}
      onClose={onClose}
      footer={
        <button
          disabled={!m.amount}
          onClick={() => {
            const move: BankMove = { id: uid(), ...m, structured: isStructuredCommunication(m.communication), account: "", ref: "", source: "manual", importedAt: nowIso(), matches: [], status: "unmatched", note: "" };
            update((d) => ({ ...d, bankMoves: [move, ...d.bankMoves] }));
            onClose();
          }}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {t("Enregistrer")}
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Date")}>
          <input type="date" className={inputClass} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
        </Field>
        <Field label={t("Montant (négatif = paiement)")}>
          <input type="number" step="0.01" className={inputClass} value={m.amount || ""} onChange={(e) => setM({ ...m, amount: e.target.valueAsNumber || 0 })} />
        </Field>
        <Field label={t("Contrepartie")}>
          <input className={inputClass} value={m.counterparty} onChange={(e) => setM({ ...m, counterparty: e.target.value })} />
        </Field>
        <Field label={t("Communication")}>
          <input className={inputClass} value={m.communication} onChange={(e) => setM({ ...m, communication: e.target.value })} placeholder="+++000/0000/00000+++" />
        </Field>
      </div>
    </Modal>
  );
}

export function BankTab() {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, run } = useAppData();
  const [tab, setTab] = useState<"todo" | "done" | "all">("todo");
  const [q, setQ] = useState("");
  const [matching, setMatching] = useState<BankMove | null>(null);
  const [manual, setManual] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger" | "info"; text: string } | null>(null);

  const moves = data.bankMoves;
  const todo = moves.filter((m) => m.status === "unmatched" || m.status === "surplus");
  const list = useMemo(() => {
    const base = tab === "todo" ? todo : tab === "done" ? moves.filter((m) => m.status === "matched" || m.status === "partial") : moves;
    const s = q.trim().toLowerCase();
    return base.filter((m) => !s || [m.counterparty, m.communication, m.account, String(m.amount)].some((x) => x.toLowerCase().includes(s))).sort((a, b) => b.date.localeCompare(a.date));
  }, [moves, todo, tab, q]);

  const read = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseCoda(await file.text());
      if (!parsed.length) throw new Error();
      const r = run((d) => importMoves(d, parsed, "coda"));
      setMsg({ tone: "ok", text: t("{a} mouvement(s) importé(s), {m} lettré(s) automatiquement, {d} doublon(s) ignoré(s).", { a: r.added, m: r.matched, d: r.duplicates }) });
    } catch {
      setMsg({ tone: "danger", text: t("Fichier non reconnu : exportez l'extrait au format CODA (.cod) depuis votre banque.") });
    }
  };

  const label = (m: BankMove) =>
    m.matches
      .map((x) => (x.kind === "invoice" ? data.docs.find((d) => d.id === x.id)?.number : data.purchases.find((p) => p.id === x.id)?.number) ?? "?")
      .join(", ");

  return (
    <div>
      <PageHeader
        title={t("Banque")}
        subtitle={t("Extraits CODA, lettrage des factures clients et fournisseurs")}
        actions={
          <>
            <button onClick={() => setManual(true)} className="btn-ghost !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Mouvement")}
            </button>
            <label className="btn-primary cursor-pointer !py-2.5 text-sm">
              <Upload className="h-4 w-4" /> {t("Importer un extrait CODA")}
              <input type="file" accept=".cod,.coda,.txt,.cod2" className="sr-only" onChange={(e) => (read(e.target.files?.[0]), (e.target.value = ""))} />
            </label>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label={t("À lettrer")} value={String(todo.length)} tone={todo.length ? "warn" : "ok"} />
        <Stat label={t("Encaissements")} value={f.money0(moves.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0))} />
        <Stat label={t("Paiements")} value={f.money0(-moves.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0))} />
        <Stat label={t("Factures ouvertes")} value={String(openInvoicesFor(data).length)} sub={f.money0(openInvoicesFor(data).reduce((s, d) => s + invoiceDue(d), 0))} />
      </div>
      {msg && (
        <div className="mb-4">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      )}
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4 text-sm">
        <RefreshCw className="h-4 w-4 text-cyan" />
        <span className="flex-1 text-slate-300">
          <strong className="text-white">{pontoProvider.name}</strong> — {t("synchronisation automatique de vos comptes bancaires belges. Nécessite le serveur Biltov (identifiants et certificat Ponto) : en attendant, importez vos extraits CODA.")}
        </span>
        <button disabled className="btn-ghost !py-2 text-sm opacity-40">
          {t("Connecter Ponto")}
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SubTabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "todo", label: t("À traiter"), count: todo.length },
            { id: "done", label: t("Lettrés") },
            { id: "all", label: t("Tous"), count: moves.length },
          ]}
        />
        <div className="min-w-[220px] flex-1">
          <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : contrepartie, communication, montant…")} />
        </div>
      </div>
      {!moves.length ? (
        <Empty icon={Landmark} text={t("Importez l'extrait CODA de votre banque : chaque virement est rapproché de sa facture grâce à la communication structurée.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {list.map((m) => {
            const st = BANK_STATUS[m.status];
            const valid = m.structured || isStructuredCommunication(m.communication);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-24 shrink-0 tabular-nums text-xs text-slate-500">{f.date(m.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-100">{m.counterparty || m.account || "—"}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                    {m.communication ? (
                      <>
                        {/^\d{12}$/.test(m.communication.replace(/\D/g, "")) &&
                          (valid ? <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald" aria-label={t("Communication valide")} /> : <XCircle className="h-3 w-3 shrink-0 text-rose-400" aria-label={t("Communication invalide")} />)}
                        {m.communication}
                      </>
                    ) : (
                      "—"
                    )}
                    {m.matches.length > 0 && <span className="text-cyan"> → {label(m)}</span>}
                  </span>
                </span>
                <span className={cn("font-semibold tabular-nums", m.amount > 0 ? "text-emerald" : "text-rose-300")}>
                  {m.amount > 0 ? "+" : ""}
                  {f.money(m.amount)}
                </span>
                <Badge label={t(st.label)} style={st.style} />
                <span className="flex gap-1">
                  {m.status !== "ignored" && (
                    <button onClick={() => setMatching(m)} className="rounded-lg p-2 text-slate-400 hover:text-cyan" title={t("Lettrer")} aria-label={t("Lettrer")}>
                      <Link2 className="h-4 w-4" />
                    </button>
                  )}
                  {m.matches.length > 0 && (
                    <button onClick={() => update((d) => unmatch(d, m.id))} className="rounded-lg p-2 text-slate-400 hover:text-amber-300" title={t("Annuler le lettrage")} aria-label={t("Annuler le lettrage")}>
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                  {!m.matches.length && (
                    <button
                      onClick={() => update((d) => ({ ...d, bankMoves: d.bankMoves.map((x) => (x.id === m.id ? { ...x, status: x.status === "ignored" ? "unmatched" : "ignored" } : x)) }))}
                      className="rounded-lg p-2 text-slate-400 hover:text-white"
                      title={m.status === "ignored" ? t("Rétablir") : t("Ignorer (frais bancaires, salaires…)")}
                      aria-label={t("Ignorer")}
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                </span>
              </li>
            );
          })}
          {!list.length && <li className="p-6 text-center text-emerald">{t("Tout est lettré.")}</li>}
        </ul>
      )}
      <AnimatePresence>
        {matching && <MatchDialog key={matching.id} move={matching} onClose={() => setMatching(null)} />}
        {manual && <ManualMove onClose={() => setManual(false)} />}
      </AnimatePresence>
    </div>
  );
}
