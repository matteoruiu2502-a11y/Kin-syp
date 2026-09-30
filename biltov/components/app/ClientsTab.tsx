"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Mail, MapPin, Pencil, Phone, Plus, Upload, Users } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { CLIENT_FIELDS, clientsFromParsed, workbookBlob } from "@/lib/app/catalog/import";
import { computeTotals } from "@/lib/app/money";
import { CLIENT_KIND, DOC_STATUS, JOB_STATUS } from "@/lib/app/labels";
import { downloadBlob } from "@/lib/app/send";
import { docTitle } from "@/lib/app/pdf";
import { todayIso } from "@/lib/app/defaults";
import type { AccountData, Client } from "@/lib/app/types";
import { Badge, DataTable, Empty, PageHeader, SearchBox, Stat, inputClass } from "./ui";
import { ClientForm } from "./ClientForm";
import { ImportWizard } from "./ImportWizard";

export function clientBalance(d: AccountData, clientId: string) {
  const invs = d.docs.filter((x) => x.clientId === clientId && x.type === "invoice" && x.lockedAt && x.status !== "cancelled");
  const billed = invs.reduce((s, x) => s + computeTotals(x).payable, 0) - d.docs.filter((x) => x.clientId === clientId && x.type === "credit" && x.lockedAt).reduce((s, x) => s + computeTotals(x).tvac, 0);
  const paid = invs.reduce((s, x) => s + computeTotals(x).paid, 0);
  return { billed, paid, due: Math.max(0, billed - paid) };
}

export function ClientsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update } = useAppData();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState({ key: "name", dir: "asc" as "asc" | "desc" });
  const [form, setForm] = useState(false);
  const [importing, setImporting] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.clients.filter((c) => (kind === "all" || c.kind === kind) && (!s || [c.name, c.contactName, c.email, c.phone, c.billing.city, c.vatNumber, ...c.tags].some((x) => x.toLowerCase().includes(s))));
  }, [data.clients, q, kind]);

  const exportXlsx = async () =>
    downloadBlob(
      await workbookBlob([{ name: "Clients", headers: CLIENT_FIELDS.map((x) => x.label), rows: data.clients.map((c) => [c.name, c.kind, c.vatNumber, c.bce, c.email, c.phone, c.billing.street, c.billing.postcode, c.billing.city, c.lang]) }]),
      `biltov-clients-${todayIso()}.xlsx`,
    );

  return (
    <div>
      <PageHeader
        title={t("Clients")}
        subtitle={t("{n} client(s)", { n: data.clients.length })}
        actions={
          <>
            <button onClick={() => setImporting(true)} className="btn-ghost !py-2.5 text-sm">
              <Upload className="h-4 w-4" /> {t("Importer")}
            </button>
            <button onClick={exportXlsx} className="btn-ghost !py-2.5 text-sm">
              <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={() => setForm(true)} className="btn-primary !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> {t("Nouveau client")}
            </button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher : nom, e-mail, localité, TVA…")} />
        <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("Type de client")}>
          <option value="all">{t("Tous les types")}</option>
          {Object.entries(CLIENT_KIND).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
      </div>
      {data.clients.length === 0 ? (
        <Empty icon={Users} text={t("Aucun client. Ajoutez-en un ou importez votre fichier Excel.")} />
      ) : (
        <DataTable
          rows={rows}
          onRow={(c) => onOpen(c.id)}
          sort={sort}
          onSort={(key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
          cols={[
            { key: "name", label: t("Nom"), sort: (c) => c.name, render: (c) => <span className="font-semibold text-slate-100">{c.name}</span> },
            { key: "kind", label: t("Type"), sort: (c) => c.kind, render: (c) => <span className="text-slate-400">{t(CLIENT_KIND[c.kind]).split(" (")[0]}</span> },
            { key: "city", label: t("Localité"), sort: (c) => c.billing.city, render: (c) => <span className="text-slate-400">{c.billing.city}</span> },
            { key: "lang", label: t("Langue"), sort: (c) => c.lang, render: (c) => <span className="uppercase text-slate-400">{c.lang}</span> },
            { key: "jobs", label: t("Chantiers"), sort: (c) => data.jobs.filter((j) => j.clientId === c.id).length, render: (c) => data.jobs.filter((j) => j.clientId === c.id).length, className: "text-right" },
            { key: "due", label: t("Reste dû"), sort: (c) => clientBalance(data, c.id).due, render: (c) => <span className="font-semibold tabular-nums">{f.money(clientBalance(data, c.id).due)}</span>, className: "text-right" },
          ]}
          empty={t("Aucun client ne correspond.")}
        />
      )}
      <AnimatePresence>
        {form && <ClientForm client={null} onClose={() => setForm(false)} onSaved={(c) => onOpen(c.id)} />}
        {importing && (
          <ImportWizard
            title={t("Importer des clients")}
            fields={CLIENT_FIELDS}
            onClose={() => setImporting(false)}
            plan={(parsed, dup) => {
              const r = clientsFromParsed(parsed, data.clients, dup);
              return {
                create: r.create.length,
                update: r.update.length,
                skipped: r.skipped,
                preview: [...r.create, ...r.update].map((c) => ({ label: c.name, detail: `${t(CLIENT_KIND[c.kind]).split(" (")[0]} · ${c.billing.city}` })),
                apply: () => update((d) => ({ ...d, clients: [...d.clients.map((x) => r.update.find((u) => u.id === x.id) ?? x), ...r.create] })),
              };
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function ClientDetail({ client, onBack, onOpenJob, onOpenDoc, onNewJob }: { client: Client; onBack: () => void; onOpenJob: (id: string) => void; onOpenDoc: (id: string) => void; onNewJob: (clientId: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [edit, setEdit] = useState(false);
  const jobs = data.jobs.filter((j) => j.clientId === client.id);
  const docs = data.docs.filter((d) => d.clientId === client.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const bal = clientBalance(data, client.id);
  const history = [
    ...docs.flatMap((d) => d.sends.map((s) => ({ at: s.at, text: `${docTitle(d, "fr")} ${d.number ?? ""} — ${s.kind === "reminder" ? t("relance") : t("envoi")} (${s.channel})` }))),
    ...docs.flatMap((d) => d.payments.map((p) => ({ at: p.date, text: `${t("Paiement")} ${f.money(p.amount)} — ${d.number}` }))),
    ...data.audit.filter((a) => a.entityId === client.id).map((a) => ({ at: a.at, text: `${a.action} ${a.detail}` })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {t("Tous les clients")}
      </button>
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{client.name}</h1>
          <p className="mt-1 text-slate-400">
            {t(CLIENT_KIND[client.kind])} · {client.lang.toUpperCase()}
            {client.vatNumber ? ` · ${client.vatNumber}` : ""}
            {client.peppolId ? ` · Peppol ${client.peppolId}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {[client.billing.street, client.billing.postcode, client.billing.city].filter(Boolean).join(", ")}
            </span>
            {client.phone && (
              <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-3.5 w-3.5" /> {client.phone}
              </a>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="h-3.5 w-3.5" /> {client.email}
              </a>
            )}
          </div>
          {client.notes && <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{client.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEdit(true)} className="btn-ghost !px-3 text-sm">
            <Pencil className="h-4 w-4" /> {t("Modifier")}
          </button>
          <button onClick={() => onNewJob(client.id)} className="btn-primary !px-4 text-sm">
            <Plus className="h-4 w-4" /> {t("Nouveau chantier")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Facturé (TVAC)")} value={f.money(bal.billed)} />
        <Stat label={t("Encaissé")} value={f.money(bal.paid)} tone="ok" />
        <Stat label={t("Reste dû")} value={f.money(bal.due)} tone={bal.due > 0 ? "warn" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-white">{t("Chantiers")}</h2>
          <ul className="divide-y divide-white/5">
            {jobs.map((j) => (
              <li key={j.id}>
                <button onClick={() => onOpenJob(j.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-cyan">
                  <span className="text-slate-100">{j.name}</span>
                  <Badge label={t(JOB_STATUS[j.status].label)} style={JOB_STATUS[j.status].style} />
                </button>
              </li>
            ))}
            {!jobs.length && <li className="py-4 text-sm text-slate-500">—</li>}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-white">{t("Devis et factures")}</h2>
          <ul className="divide-y divide-white/5">
            {docs.map((d) => (
              <li key={d.id}>
                <button onClick={() => onOpenDoc(d.id)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                  <span className="text-slate-100">
                    {docTitle(d, "fr").toLowerCase()} {d.number}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge label={t(DOC_STATUS[d.status].label)} style={DOC_STATUS[d.status].style} />
                    <span className="w-24 text-right tabular-nums">{f.money(computeTotals(d).tvac)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!docs.length && <li className="py-4 text-sm text-slate-500">—</li>}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 font-display text-lg font-bold text-white">{t("Historique")}</h2>
        <ul className="space-y-1.5 text-sm text-slate-400">
          {history.slice(0, 30).map((h, i) => (
            <li key={i}>
              <span className="tabular-nums text-slate-500">{f.date(h.at)}</span> — {h.text}
            </li>
          ))}
          {!history.length && <li>—</li>}
        </ul>
      </section>
      <AnimatePresence>{edit && <ClientForm client={client} onClose={() => setEdit(false)} />}</AnimatePresence>
    </div>
  );
}
