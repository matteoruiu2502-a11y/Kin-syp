"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Blocks, CheckCircle2, Copy, Download, Factory, Globe, Mail, MessageCircle, Plus, Send, Star } from "lucide-react";
import { useAppData, compressImage } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { nowIso, todayIso, uid } from "@/lib/app/defaults";
import { MODULES } from "@/lib/app/labels";
import { MODULE_SCHEMAS, campaignRecipients, campaignText, type ModuleSchema } from "@/lib/app/modules";
import { buildSiteHtml } from "@/lib/app/website";
import { downloadBlob, openChannel } from "@/lib/app/send";
import type { GenericRecord, ModuleId } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Badge, Empty, Field, Modal, Notice, PageHeader, SearchBox, Toggle, inputClass } from "./ui";
import { EventForm, EVENT_KIND, blankEvent } from "./PlanningTab";
import { FilesPanel, ChatPanel } from "./FieldPanels";
import { ExpensesList } from "./ExpensesPanel";

const TONE: Record<string, string> = {
  info: "bg-blue/15 text-sky-300 ring-blue/30",
  warn: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  ok: "bg-emerald/10 text-emerald ring-emerald/30",
  muted: "bg-white/5 text-slate-400 ring-white/10",
};

/** Modules pris en charge par un écran dédié ailleurs dans l'application. */
export const MODULE_ROUTE: Partial<Record<ModuleId, string>> = { catalog: "catalogue", clients: "clients", planning: "planning", time: "equipe", purchases: "achats", stock: "stock", fleet: "flotte" };

function RecordForm({ module, schema, record, onClose }: { module: ModuleId; schema: ModuleSchema; record: GenericRecord | null; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert, remove } = useAppData();
  const [r, setR] = useState<GenericRecord>(record ?? { id: uid(), module, title: "", status: schema.statuses[0].id, fields: {}, jobId: null, clientId: null, memberId: null, createdAt: nowIso(), updatedAt: nowIso() });
  const setField = (k: string, v: string | number | boolean) => setR((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));
  const supplierId = String(r.fields.supplierId ?? "");
  const articleId = String(r.fields.articleId ?? "");
  return (
    <Modal
      title={record ? r.title : t(MODULES[module].label)}
      onClose={onClose}
      wide
      footer={
        <>
          {record && (
            <button onClick={() => window.confirm(t("Supprimer ?")) && (remove("records", r.id), onClose())} className="btn-ghost mr-auto text-sm text-rose-300">
              {t("Supprimer")}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost text-sm">
            {t("Annuler")}
          </button>
          <button disabled={!r.title.trim()} onClick={() => (upsert("records", { ...r, updatedAt: nowIso() }), onClose())} className="btn-primary text-sm disabled:opacity-40">
            {t("Enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t(schema.title)} *`} className="sm:col-span-2">
          <input className={inputClass} value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} />
        </Field>
        <Field label={t("Statut")}>
          <select className={inputClass} value={r.status} onChange={(e) => setR({ ...r, status: e.target.value })}>
            {schema.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.label)}
              </option>
            ))}
          </select>
        </Field>
        {schema.links.includes("client") && (
          <Field label={t("Client")}>
            <select className={inputClass} value={r.clientId ?? ""} onChange={(e) => setR({ ...r, clientId: e.target.value || null })}>
              <option value="">—</option>
              {data.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {schema.links.includes("job") && (
          <Field label={t("Chantier")}>
            <select className={inputClass} value={r.jobId ?? ""} onChange={(e) => setR({ ...r, jobId: e.target.value || null, clientId: r.clientId ?? data.jobs.find((j) => j.id === e.target.value)?.clientId ?? null })}>
              <option value="">—</option>
              {data.jobs
                .filter((j) => !r.clientId || j.clientId === r.clientId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {schema.links.includes("member") && (
          <Field label={t("Responsable")}>
            <select className={inputClass} value={r.memberId ?? ""} onChange={(e) => setR({ ...r, memberId: e.target.value || null })}>
              <option value="">—</option>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {schema.links.includes("supplier") && (
          <Field label={t("Fournisseur / sous-traitant")}>
            <select className={inputClass} value={supplierId} onChange={(e) => setField("supplierId", e.target.value)}>
              <option value="">—</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {schema.links.includes("article") && (
          <Field label={t("Ouvrage à fabriquer")} hint={t("Un ouvrage composé : ses composants seront sortis du stock.")}>
            <select className={inputClass} value={articleId} onChange={(e) => setField("articleId", e.target.value)}>
              <option value="">—</option>
              {data.articles
                .filter((a) => a.components.length)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name.fr}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {schema.fields.map((fd) => {
          const v = r.fields[fd.key];
          const cls = fd.type === "textarea" ? "sm:col-span-2" : "";
          if (fd.type === "bool")
            return (
              <div key={fd.key} className="pt-6">
                <Toggle checked={!!v} onChange={(x) => setField(fd.key, x)} label={t(fd.label)} />
              </div>
            );
          return (
            <Field key={fd.key} label={t(fd.label)} className={cls}>
              {fd.type === "textarea" ? (
                <textarea rows={5} className={inputClass} value={String(v ?? "")} onChange={(e) => setField(fd.key, e.target.value)} />
              ) : fd.type === "select" ? (
                <select className={inputClass} value={String(v ?? "")} onChange={(e) => setField(fd.key, e.target.value)}>
                  <option value="">—</option>
                  {fd.options!.map((o) => (
                    <option key={o} value={o}>
                      {t(o)}
                    </option>
                  ))}
                </select>
              ) : fd.type === "rating" ? (
                <div className="flex gap-1 pt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setField(fd.key, n)} aria-label={`${n}/5`}>
                      <Star className={cn("h-6 w-6", Number(v) >= n ? "fill-amber-400 text-amber-400" : "text-slate-600")} />
                    </button>
                  ))}
                </div>
              ) : (
                <input type={fd.type === "date" ? "date" : fd.type === "text" ? "text" : "number"} step={fd.type === "money" ? "0.01" : undefined} className={inputClass} value={String(v ?? "")} onChange={(e) => setField(fd.key, fd.type === "number" || fd.type === "money" ? e.target.valueAsNumber || 0 : e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
    </Modal>
  );
}

function GenericModule({ module }: { module: ModuleId }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update } = useAppData();
  const schema = MODULE_SCHEMAS[module]!;
  const [editing, setEditing] = useState<GenericRecord | "new" | null>(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [campaign, setCampaign] = useState<GenericRecord | null>(null);
  const today = todayIso();
  const rows = data.records
    .filter((r) => r.module === module && (status === "all" || r.status === status) && (!q || r.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const listFields = schema.fields.filter((x) => x.list);
  const fmt = (type: string, v: unknown) => (v === undefined || v === "" ? "—" : type === "date" ? f.date(String(v)) : type === "money" ? f.money(Number(v)) : type === "rating" ? "★".repeat(Number(v)) : type === "bool" ? (v ? "✓" : "—") : t(String(v)));
  const closed = (r: GenericRecord) => ["resolved", "returned", "done", "hired", "refused", "declined", "answered", "sent", "published"].includes(r.status);

  const produce = (r: GenericRecord) => {
    const art = data.articles.find((a) => a.id === r.fields.articleId);
    const qty = Number(r.fields.qty || 1);
    const loc = data.stockLocations[0]?.id;
    update((d) => ({
      ...d,
      records: d.records.map((x) => (x.id === r.id ? { ...x, status: "done", updatedAt: nowIso() } : x)),
      stockMoves: loc && art ? [...d.stockMoves, ...art.components.map((c) => ({ id: uid(), articleId: c.articleId, locationId: loc, qty: -c.qty * qty, date: today, reason: `${t("Fabrication")} ${r.title}`, jobId: r.jobId })), { id: uid(), articleId: art.id, locationId: loc, qty, date: today, reason: `${t("Fabrication")} ${r.title}`, jobId: r.jobId }] : d.stockMoves,
    }));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={cn(inputClass, "!w-auto")} value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("Statut")}>
          <option value="all">{t("Tous les statuts")}</option>
          {schema.statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {t(s.label)}
            </option>
          ))}
        </select>
        <div className="min-w-[220px] flex-1">
          <SearchBox value={q} onChange={setQ} placeholder={t("Rechercher…")} />
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary !py-2.5 text-sm">
          <Plus className="h-4 w-4" /> {t("Ajouter")}
        </button>
      </div>
      {!rows.length ? (
        <Empty icon={Blocks} text={t(MODULES[module].desc)} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {rows.map((r) => {
            const st = schema.statuses.find((s) => s.id === r.status) ?? schema.statuses[0];
            const late = schema.due && r.fields[schema.due] && String(r.fields[schema.due]) < today && !closed(r);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold text-slate-100">{r.title}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[r.clientId && data.clients.find((c) => c.id === r.clientId)?.name, r.jobId && data.jobs.find((j) => j.id === r.jobId)?.name, r.memberId && data.members.find((m) => m.id === r.memberId)?.name, r.fields.supplierId && data.suppliers.find((s) => s.id === r.fields.supplierId)?.name]
                      .filter(Boolean)
                      .join(" · ")}
                    {listFields.map((fd) => ` · ${t(fd.label)} : ${fmt(fd.type, r.fields[fd.key])}`).join("")}
                  </p>
                </button>
                {late && <span className="text-xs text-amber-300">{t("en retard")}</span>}
                {module === "marketing" && r.status === "draft" && (
                  <button onClick={() => setCampaign(r)} className="btn-primary !px-3 !py-1.5 text-xs">
                    <Send className="h-3.5 w-3.5" /> {t("Envoyer")}
                  </button>
                )}
                {module === "surveys" && r.status === "draft" && (
                  <SurveySend record={r} />
                )}
                {module === "manufacturing" && r.status !== "done" && !!r.fields.articleId && (
                  <button onClick={() => produce(r)} className="btn-ghost !px-3 !py-1.5 text-xs">
                    <Factory className="h-3.5 w-3.5" /> {t("Terminer et mettre en stock")}
                  </button>
                )}
                <Badge label={t(st.label)} style={TONE[st.tone]} />
              </li>
            );
          })}
        </ul>
      )}
      <AnimatePresence>
        {editing && <RecordForm module={module} schema={schema} record={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
        {campaign && <CampaignSend record={campaign} onClose={() => setCampaign(null)} />}
      </AnimatePresence>
    </div>
  );
}

function SurveySend({ record }: { record: GenericRecord }) {
  const { t } = useTr();
  const { data, upsert } = useAppData();
  const client = data.clients.find((c) => c.id === record.clientId);
  if (!client?.email && !client?.phone) return null;
  const body = t("Bonjour {n},\n\nMerci de nous avoir fait confiance. Pourriez-vous nous dire en une minute :\n1. Votre note de 1 à 5 ?\n2. Nous recommanderiez-vous ?\n3. Un commentaire ?\n\nIl suffit de répondre à ce message.\n\n{c}", { n: client.contactName || client.name, c: data.company.name });
  return (
    <button
      onClick={() => {
        openChannel(client.email ? "email" : "whatsapp", { email: client.email, phone: client.phone }, t("Votre avis sur nos travaux"), body);
        upsert("records", { ...record, status: "sent", updatedAt: nowIso() });
      }}
      className="btn-primary !px-3 !py-1.5 text-xs"
    >
      <Send className="h-3.5 w-3.5" /> {t("Envoyer")}
    </button>
  );
}

function CampaignSend({ record, onClose }: { record: GenericRecord; onClose: () => void }) {
  const { t } = useTr();
  const { data, upsert } = useAppData();
  const channel = String(record.fields.channel || "E-mail");
  const list = campaignRecipients(data.clients, String(record.fields.tag ?? ""), channel);
  const message = String(record.fields.message ?? "");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  return (
    <Modal title={t("Envoyer la campagne « {n} »", { n: record.title })} onClose={onClose} wide footer={<button onClick={() => (upsert("records", { ...record, status: "sent", updatedAt: nowIso() }), onClose())} className="btn-primary text-sm"><CheckCircle2 className="h-4 w-4" /> {t("Marquer comme envoyée")}</button>}>
      <div className="space-y-4">
        <Notice>{t("Seuls les clients ayant accepté de recevoir vos communications (consentement RGPD sur la fiche client) sont repris.")}</Notice>
        <p className="text-sm text-slate-300">{t("{n} destinataire(s)", { n: list.length })}</p>
        {channel === "E-mail" ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(list.map((c) => c.email).join("; "));
                setCopied(true);
              }}
              className="btn-ghost !py-2 text-sm"
            >
              <Copy className="h-4 w-4" /> {copied ? t("Adresses copiées") : t("Copier les adresses (à coller en Cci)")}
            </button>
            <a href={`mailto:?bcc=${encodeURIComponent(list.map((c) => c.email).join(","))}&subject=${encodeURIComponent(record.title)}&body=${encodeURIComponent(campaignText(message, ""))}`} className="btn-primary !py-2 text-sm">
              <Mail className="h-4 w-4" /> {t("Ouvrir dans ma messagerie")}
            </a>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto rounded-2xl border border-white/10 text-sm">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-slate-200">{c.name}</span>
                <button
                  onClick={() => {
                    openChannel(channel === "SMS" ? "sms" : "whatsapp", { phone: c.phone }, record.title, campaignText(message, c.contactName || c.name));
                    setSent((s) => [...s, c.id]);
                  }}
                  className="btn-ghost !px-3 !py-1 text-xs"
                >
                  {sent.includes(c.id) ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald" /> : <MessageCircle className="h-3.5 w-3.5" />} {channel}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">{t("L'envoi groupé automatique nécessitera le serveur ; ici chaque message part depuis votre téléphone ou votre messagerie.")}</p>
      </div>
    </Modal>
  );
}

function WebsiteModule() {
  const { t } = useTr();
  const { data, upsert, getBlob } = useAppData();
  const existing = data.records.find((r) => r.module === "website");
  const [r, setR] = useState<GenericRecord>(existing ?? { id: uid(), module: "website", title: data.company.name, status: "draft", fields: { headline: "", about: "", services: "", area: "" }, jobId: null, clientId: null, memberId: null, createdAt: nowIso(), updatedAt: nowIso() });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setR((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));
  const after = data.photos.filter((p) => p.phase === "apres").slice(0, 9);
  const build = async () => {
    setBusy(true);
    upsert("records", { ...r, updatedAt: nowIso() });
    const photos: string[] = [];
    for (const p of after) {
      const b = await getBlob(`photo:${p.id}`);
      if (!b) continue;
      const small = await compressImage(b, 900, 0.75);
      photos.push(await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(small.blob);
      }));
    }
    const html = buildSiteHtml(data.company, data.branding, { headline: String(r.fields.headline ?? ""), about: String(r.fields.about ?? ""), services: String(r.fields.services ?? ""), area: String(r.fields.area ?? ""), photos });
    downloadBlob(new Blob([html], { type: "text/html" }), "index.html");
    setBusy(false);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <Field label={t("Accroche")}>
          <input className={inputClass} value={String(r.fields.headline ?? "")} onChange={(e) => set("headline", e.target.value)} placeholder={t("Rénovation de salles de bain à Liège depuis 2008")} />
        </Field>
        <Field label={t("Présentation")}>
          <textarea rows={4} className={inputClass} value={String(r.fields.about ?? "")} onChange={(e) => set("about", e.target.value)} />
        </Field>
        <Field label={t("Services (un par ligne)")}>
          <textarea rows={4} className={inputClass} value={String(r.fields.services ?? "")} onChange={(e) => set("services", e.target.value)} />
        </Field>
        <Field label={t("Zone d'intervention")}>
          <input className={inputClass} value={String(r.fields.area ?? "")} onChange={(e) => set("area", e.target.value)} />
        </Field>
        <button onClick={build} disabled={busy} className="btn-primary text-sm disabled:opacity-40">
          <Download className="h-4 w-4" /> {t("Télécharger la page (HTML)")}
        </button>
      </div>
      <div className="space-y-3">
        <Notice>{t("Une page unique avec vos coordonnées, vos services, vos photos « après » ({n}) et un bouton « Demander un devis » (e-mail). Hébergez-la chez votre fournisseur de nom de domaine ou sur un hébergement gratuit.", { n: after.length })}</Notice>
        <div className="card flex items-center gap-3 p-4 text-sm text-slate-400">
          <Globe className="h-5 w-5 text-cyan" /> {t("La prise de rendez-vous en ligne et le formulaire relié à Biltov nécessiteront le serveur.")}
        </div>
      </div>
    </div>
  );
}

function EventsModule({ kinds }: { kinds: PlanningKinds }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const [editing, setEditing] = useState<ReturnType<typeof blankEvent> | null>(null);
  const list = data.events.filter((e) => kinds.includes(e.kind)).sort((a, b) => b.start.localeCompare(a.start));
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing(blankEvent(todayIso(), { kind: kinds[0] }))} className="btn-primary !py-2.5 text-sm">
          <Plus className="h-4 w-4" /> {t("Ajouter")}
        </button>
      </div>
      {!list.length ? (
        <Empty icon={Blocks} text={t("Rien pour l'instant.")} />
      ) : (
        <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
          {list.map((e) => (
            <li key={e.id}>
              <button onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: EVENT_KIND[e.kind].color }} />
                <span className="min-w-0 flex-1 truncate text-slate-100">
                  {e.title}
                  <span className="text-slate-500">
                    {" "}
                    · {e.memberIds.map((id) => data.members.find((m) => m.id === id)?.name).join(", ")}
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {f.date(e.start.slice(0, 10))}
                  {e.end.slice(0, 10) !== e.start.slice(0, 10) && ` → ${f.date(e.end.slice(0, 10))}`}
                </span>
                <span className="text-xs text-slate-500">{t({ planned: "Planifié", done: "Fait", cancelled: "Annulé", requested: "Demandé", approved: "Approuvé", refused: "Refusé" }[e.status])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <AnimatePresence>{editing && <EventForm event={editing} onClose={() => setEditing(null)} />}</AnimatePresence>
    </div>
  );
}
type PlanningKinds = ("job" | "visit" | "appointment" | "leave" | "maintenance")[];

function ReportsModule({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data } = useAppData();
  const list = [...data.reports].sort((a, b) => b.date.localeCompare(a.date));
  return !list.length ? (
    <Empty icon={Blocks} text={t("Les rapports se créent depuis la fiche du chantier ou l'espace ouvrier.")} />
  ) : (
    <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 text-sm">
      {list.map((r) => (
        <li key={r.id}>
          <button onClick={() => onOpenJob(r.jobId)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span className="text-slate-100">
              {f.date(r.date)} — {data.jobs.find((j) => j.id === r.jobId)?.name}
            </span>
            <span className="text-xs text-slate-400">
              {t({ intervention: "Bon d'intervention", daily: "Rapport journalier", reception: "PV de réception", maintenance: "Entretien" }[r.kind])} · {r.signature ? t("signé") : t("non signé")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatModule() {
  const { t } = useTr();
  const { data } = useAppData();
  const jobs = data.jobs.filter((j) => data.records.some((r) => r.module === "chat" && r.jobId === j.id) || ["accepted", "in_progress"].includes(j.status));
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  return (
    <div className="space-y-3">
      <select className={cn(inputClass, "!w-auto")} value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label={t("Chantier")}>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </select>
      {jobId ? <ChatPanel key={jobId} jobId={jobId} /> : <Empty icon={Blocks} text={t("Aucun chantier en cours.")} />}
    </div>
  );
}

/** Hub des modules + écrans des modules sans onglet dédié. */
export function ModulesTab({ module, onOpen, onBack, go, onOpenJob }: { module: ModuleId | null; onOpen: (m: ModuleId) => void; onBack: () => void; go: (route: string) => void; onOpenJob: (id: string) => void }) {
  const { t } = useTr();
  const { data, update } = useAppData();
  const mods = data.settings.modules;
  const toggle = (m: ModuleId, v: boolean) => update((d) => ({ ...d, settings: { ...d.settings, modules: { ...d.settings.modules, [m]: v } } }));

  if (module)
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> {t("Modules")}
        </button>
        <PageHeader title={t(MODULES[module].label)} subtitle={t(MODULES[module].desc)} />
        {module === "website" ? (
          <WebsiteModule />
        ) : module === "leaves" ? (
          <EventsModule kinds={["leave"]} />
        ) : module === "appointments" ? (
          <EventsModule kinds={["visit", "appointment"]} />
        ) : module === "documents" ? (
          <FilesPanel jobId={null} clientId={null} />
        ) : module === "chat" ? (
          <ChatModule />
        ) : module === "expenses" ? (
          <ExpensesList jobId={null} />
        ) : module === "reports" ? (
          <ReportsModule onOpenJob={onOpenJob} />
        ) : MODULE_SCHEMAS[module] ? (
          <GenericModule module={module} />
        ) : null}
      </div>
    );

  return (
    <div>
      <PageHeader title={t("Modules")} subtitle={t("Activez uniquement ce dont vous avez besoin : les menus s'adaptent.")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(MODULES) as ModuleId[]).map((m) => {
          const count = data.records.filter((r) => r.module === m).length;
          return (
            <div key={m} className={cn("card flex flex-col gap-3 p-5", !mods[m] && "opacity-60")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{t(MODULES[m].label)}</p>
                  <p className="text-xs text-slate-400">{t(MODULES[m].desc)}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" checked={!!mods[m]} onChange={(e) => toggle(m, e.target.checked)} aria-label={t(MODULES[m].label)} />
                  <span className="h-6 w-11 rounded-full bg-white/10 transition-colors peer-checked:bg-emerald" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
              {mods[m] && (
                <button onClick={() => (MODULE_ROUTE[m] ? go(MODULE_ROUTE[m]!) : onOpen(m))} className="btn-ghost mt-auto !py-2 text-sm">
                  {t("Ouvrir")} {count > 0 && <span className="text-xs text-slate-500">({count})</span>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
