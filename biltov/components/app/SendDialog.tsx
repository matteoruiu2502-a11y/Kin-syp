"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileCode2, Loader2, Mail, MessageCircle, Printer, Send, Share2, Smartphone } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { useTr } from "@/lib/app/tr";
import { useFmt } from "@/lib/app/format";
import { usePdf } from "@/lib/app/usePdf";
import { canShareFiles, downloadBlob, openChannel, shareFile } from "@/lib/app/send";
import { reminderMessage, reminderState } from "@/lib/app/reminders";
import { computeTotals, eur } from "@/lib/app/money";
import { dt, fmtDate, LOCALE } from "@/lib/app/docText";
import { audit, logSend } from "@/lib/app/ops";
import { buildUbl } from "@/lib/app/peppol/ubl";
import { peppolProvider, requiresPeppol } from "@/lib/app/peppol/provider";
import { docTitle } from "@/lib/app/pdf";
import type { Doc, Lang, SendLog } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Field, Modal, Notice, inputClass } from "./ui";
import { UsageMeter, openPlans } from "./PlanGate";
import { PLANS, type PlanId } from "@/lib/plans";
import { canSendInvoice } from "@/lib/billing/entitlement";
import { BillingError, billingApi, billingConfigured } from "@/lib/billing/client";

const GREET: Record<Lang, (n: string) => string> = { fr: (n) => `Bonjour ${n},`, nl: (n) => `Beste ${n},`, de: (n) => `Guten Tag ${n},` };
const BODY: Record<Lang, (what: string, num: string, amount: string, job: string, extra: string) => string> = {
  fr: (w, n, a, j, e) => `Veuillez trouver ci-joint notre ${w} n° ${n} d'un montant de ${a} TVAC pour « ${j} ». ${e}\n\nNous restons à votre disposition.\n\nCordialement,`,
  nl: (w, n, a, j, e) => `In bijlage vindt u onze ${w} nr. ${n} voor een bedrag van ${a} incl. btw voor « ${j} ». ${e}\n\nWij blijven tot uw beschikking.\n\nMet vriendelijke groeten,`,
  de: (w, n, a, j, e) => `Anbei erhalten Sie unser(e) ${w} Nr. ${n} über ${a} brutto für « ${j} ». ${e}\n\nFür Rückfragen stehen wir gerne zur Verfügung.\n\nMit freundlichen Grüßen`,
};

/** Envoi d'un document ou d'une relance : Peppol (B2B), e-mail, WhatsApp, SMS, partage natif, courrier. */
export function SendDialog({ doc, reminder, onClose }: { doc: Doc; reminder?: boolean; onClose: () => void }) {
  const { t } = useTr();
  const f = useFmt();
  const { data, update, run, billing } = useAppData();
  const { make } = usePdf();
  const job = data.jobs.find((j) => j.id === doc.jobId)!;
  const client = data.clients.find((c) => c.id === doc.clientId);
  const lang = client?.lang ?? doc.lang;
  const c = data.company;
  const rs = reminder ? reminderState(data, doc) : null;
  const initial = useMemo(() => {
    if (rs) return reminderMessage(data, rs, lang);
    const tt = computeTotals(doc);
    const extra = doc.type === "quote" ? `${dt(lang, "validity", { d: fmtDate(doc.validUntil, lang) })}` : doc.type === "invoice" ? dt(lang, "payBy", { d: fmtDate(doc.dueDate, lang), iban: c.iban, c: doc.structuredComm || doc.number || "" }) : "";
    return { subject: `${docTitle(doc, lang)} ${doc.number} — ${job.name}`, body: `${GREET[lang](client?.contactName || client?.name || "")}\n\n${BODY[lang](docTitle(doc, lang).toLowerCase(), doc.number ?? "", eur(doc.type === "invoice" ? tt.due : tt.tvac, LOCALE[lang]), job.name, extra)}\n${c.owner || c.name}\n${c.name}` };
  }, []);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [done, setDone] = useState<string[]>([]);
  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof make>> | null>(null);
  useEffect(() => {
    void make(doc).then(setPdf);
  }, []);
  const peppol = !reminder && client && requiresPeppol(client) && (doc.type === "invoice" || doc.type === "credit");

  const record = (channel: SendLog["channel"]) => {
    run((d) => [logSend(d, doc.id, { channel, kind: reminder ? "reminder" : "document", step: rs?.step }), null]);
    setDone((x) => [...x, channel]);
  };
  const via = (channel: "email" | "whatsapp" | "sms") => {
    if (pdf) downloadBlob(pdf.blob, pdf.name);
    openChannel(channel, { email: client?.email, phone: client?.phone }, subject, channel === "email" ? body : `${body}\n\n(PDF : ${pdf?.name ?? ""})`);
    record(channel);
  };

  const buttons = [
    { id: "email" as const, label: t("E-mail"), icon: Mail, disabled: !client?.email, hint: client?.email || t("E-mail du client manquant") },
    { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle, disabled: !client?.phone, hint: client?.phone || t("Téléphone manquant") },
    { id: "sms" as const, label: "SMS", icon: Smartphone, disabled: !client?.phone, hint: client?.phone || t("Téléphone manquant") },
  ];

  return (
    <Modal title={reminder ? t("Relance — facture {n}", { n: doc.number ?? "" }) : t("Envoyer {w} {n}", { w: docTitle(doc, "fr").toLowerCase(), n: doc.number ?? "" })} onClose={onClose} footer={<button onClick={onClose} className="btn-ghost text-sm">{t("Fermer")}</button>}>
      <div className="space-y-4">
        {peppol && (
          <div className="space-y-3 rounded-2xl border border-cyan/30 bg-cyan/5 p-4 text-sm">
            <p className="font-semibold text-white">{t("Facture B2B : transmission Peppol obligatoire")}</p>
            <p className="text-slate-300">{t("Destinataire")} : {client?.peppolId || `0208:${client?.bce}`}. {t("Un PDF envoyé par e-mail n'est pas une facture électronique valable entre entreprises belges.")}</p>
            {billingConfigured && billing.creds && <PeppolSend doc={doc} receiver={client?.peppolId || `0208:${client?.bce}`} onSent={() => record("peppol")} />}
            {!peppolProvider.configured && !billingConfigured && <Notice tone="warn">{t("Aucun Access Point Peppol n'est encore branché : téléchargez le fichier UBL et déposez-le chez votre prestataire Peppol, puis marquez la facture comme transmise.")}</Notice>}
            {billingConfigured && <p className="text-xs text-slate-500">{t("Ou passez par votre propre prestataire Peppol :")}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const r = buildUbl(doc, data, client!, doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null);
                  downloadBlob(new Blob([r.xml], { type: "application/xml" }), `${doc.number}.xml`);
                }}
                className="btn-ghost !py-2 text-sm"
              >
                <FileCode2 className="h-4 w-4" /> {t("Télécharger l'UBL (Peppol BIS 3.0)")}
              </button>
              <button
                onClick={() => {
                  update((d) => audit({ ...d, docs: d.docs.map((x) => (x.id === doc.id ? { ...x, peppol: { status: "sent", at: new Date().toISOString(), message: t("Transmis via le prestataire de l'artisan") } } : x)) }, "peppol", doc.type, doc.id, "sent"));
                  record("peppol");
                }}
                className="btn-primary !py-2 text-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> {t("Marquer comme transmise via Peppol")}
              </button>
            </div>
          </div>
        )}
        {rs && (
          <Notice tone={rs.b2c ? "info" : "warn"}>
            {rs.b2c ? t("Client particulier (Livre XIX CDE) : 1er rappel gratuit, puis 14 jours sans frais ni intérêts.") : t("Client professionnel (loi du 2 août 2002) : intérêts de retard et indemnité forfaitaire.")} {rs.fees + rs.interest > 0 && `${t("Frais réclamables")} : ${f.money(rs.fees)} + ${t("intérêts")} ${f.money(rs.interest)}.`}
          </Notice>
        )}
        <Field label={t("Objet")}>
          <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label={`${t("Message")} (${lang.toUpperCase()})`}>
          <textarea className={cn(inputClass, "resize-y")} rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {pdf && canShareFiles(pdf.file) && (
          <button
            onClick={async () => {
              try {
                await shareFile(pdf.file, subject, body);
                record("share");
              } catch {}
            }}
            className="btn-primary w-full text-sm"
          >
            <Share2 className="h-4 w-4" /> {t("Partager avec le PDF joint (WhatsApp, e-mail, SMS…)")}
          </button>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {buttons.map((b) => (
            <button key={b.id} onClick={() => via(b.id)} disabled={b.disabled || !pdf} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-40">
              <span className="flex items-center gap-2">
                <b.icon className="h-4 w-4 text-cyan" /> {b.label}
                {done.includes(b.id) && <CheckCircle2 className="h-4 w-4 text-emerald" />}
              </span>
              <span className="max-w-full truncate text-[11px] font-normal text-slate-500">{b.hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (!pdf) return;
              downloadBlob(pdf.blob, pdf.name);
              record("download");
            }}
            className="btn-ghost flex-1 text-sm"
          >
            <Download className="h-4 w-4" /> {t("Télécharger le PDF")}
          </button>
          <button onClick={() => record("post")} className="btn-ghost flex-1 text-sm" title={t("Envoi papier : le délai B2C démarre au 3e jour ouvrable")}>
            <Printer className="h-4 w-4" /> {t("Envoyé par courrier")}
          </button>
        </div>
        <Notice>{t("E-mail, WhatsApp et SMS s'ouvrent avec le message prêt ; le PDF est téléchargé pour être joint. Un envoi automatique depuis Biltov nécessitera le serveur.")}</Notice>
        {doc.sends.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("Historique")}</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {[...doc.sends].reverse().map((s, i) => (
                <li key={i}>
                  {new Date(s.at).toLocaleString(f.locale)} — {s.kind === "reminder" ? `${t("relance")} ${(s.step ?? 0) + 1}` : t("document")} · {s.channel}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Envoi Peppol par Biltov : le serveur vérifie l'abonnement et le quota, envoie, puis compte la facture
 * (uniquement si l'envoi réussit). Alertes à 80 et 100 % du quota.
 */
function PeppolSend({ doc, receiver, onSent }: { doc: Doc; receiver: string; onSent: () => void }) {
  const { t } = useTr();
  const { data, update, billing, ent } = useAppData();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger" | "warn"; text: string; upgrade?: PlanId | null } | null>(null);
  const client = data.clients.find((c) => c.id === doc.clientId);
  const already = doc.peppol.status === "sent" || doc.peppol.status === "delivered";
  const check = canSendInvoice(ent, billing.used);
  const send = async () => {
    if (!billing.creds || !client) return;
    setBusy(true);
    setMsg(null);
    try {
      const ubl = buildUbl(doc, data, client, doc.sourceId ? data.docs.find((d) => d.id === doc.sourceId) : null).xml;
      const r = await billingApi.peppolSend(billing.creds, { docId: doc.id, documentNumber: doc.number ?? doc.id, receiver, ubl });
      await billing.applyLicense(r.license);
      update((d) => audit({ ...d, docs: d.docs.map((x) => (x.id === doc.id ? { ...x, peppol: { status: r.status === "delivered" ? "delivered" : "sent", at: new Date().toISOString(), message: t("Envoyée via Peppol par Biltov") } } : x)) }, "peppol", doc.type, doc.id, "sent"));
      onSent();
      setMsg({ tone: "ok", text: r.overage && ent.overagePrice !== null ? t("Facture envoyée via Peppol. Au-delà du quota : {p} € HTVA facturés en fin de période.", { p: ent.overagePrice.toFixed(2).replace(".", ",") }) : t("Facture envoyée via Peppol.") });
    } catch (e) {
      const code = e instanceof BillingError ? e.code : "";
      if (code === "quota") setMsg({ tone: "warn", text: t("Quota de factures Peppol atteint pour cette période."), upgrade: (e as BillingError).extra.upgrade as PlanId | null });
      else if (code === "readonly") setMsg({ tone: "danger", text: t("Abonnement expiré ou impayé : envoi impossible. Vos données sont conservées.") });
      else if (code === "offline") setMsg({ tone: "danger", text: t("Pas de connexion Internet : réessayez dès que possible.") });
      else setMsg({ tone: "danger", text: t("L'envoi Peppol a échoué ; la facture n'est pas comptée. Détail : {m}", { m: String((e as BillingError).extra?.message ?? code) }) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <UsageMeter />
      {already && msg?.tone === "ok" ? null : already ? (
        <p className="flex items-center gap-2 text-emerald">
          <CheckCircle2 className="h-4 w-4" /> {t("Déjà transmise via Peppol.")}
        </p>
      ) : (
        <button onClick={send} disabled={busy || !check.ok} className="btn-primary w-full !py-2 text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("Envoyer via Peppol")}
        </button>
      )}
      {!already && !check.ok && !msg && (
        <p className="text-xs" style={{ color: "var(--warning-text)" }}>
          {check.reason === "readonly" ? t("Abonnement expiré ou impayé : envoi impossible.") : t("Quota de factures Peppol atteint pour cette période.")}{" "}
          {check.reason === "quota" && check.upgrade && (
            <button onClick={() => openPlans(check.upgrade!)} className="font-semibold underline">
              {t("Passer au forfait {p}", { p: PLANS[check.upgrade].name })}
            </button>
          )}
        </p>
      )}
      {msg && (
        <Notice tone={msg.tone === "ok" ? "ok" : msg.tone === "warn" ? "warn" : "danger"}>
          {msg.text}{" "}
          {msg.upgrade && (
            <button onClick={() => openPlans(msg.upgrade!)} className="font-semibold underline">
              {t("Passer au forfait {p}", { p: PLANS[msg.upgrade].name })}
            </button>
          )}
        </Notice>
      )}
    </div>
  );
}
