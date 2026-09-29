"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, Mail, MessageCircle, Share2, Smartphone } from "lucide-react";
import { useAppData } from "@/lib/app/store";
import { usePdf } from "@/lib/app/usePdf";
import { canShareFiles, downloadBlob, openChannel, shareFile } from "@/lib/app/send";
import { reminderMessage } from "@/lib/app/reminders";
import { computeTotals, eur } from "@/lib/app/money";
import { fmtDate } from "@/lib/app/legal";
import { docTitle } from "@/lib/app/pdf";
import type { Doc } from "@/lib/app/types";
import { cn } from "@/lib/utils";
import { Field, Modal, Notice, inputClass } from "./ui";

function documentMessage(doc: Doc, jobName: string, client: string, owner: string, company: string) {
  const t = computeTotals(doc);
  const what = docTitle(doc).toLowerCase();
  const amount = doc.type === "invoice" && doc.paidBefore ? eur(t.due) : eur(t.ttc);
  const extra =
    doc.type === "quote"
      ? `Il est valable jusqu'au ${fmtDate(doc.validUntil)}. Pour l'accepter, il vous suffit de le retourner signé avec la mention « Bon pour accord ».`
      : doc.type === "invoice"
        ? `Échéance de paiement : ${fmtDate(doc.dueDate)}.`
        : "";
  return {
    subject: `${docTitle(doc)} ${doc.number} — ${jobName}`,
    body: `Bonjour ${client},\n\nVeuillez trouver ci-joint notre ${what} n° ${doc.number} d'un montant de ${amount} TTC pour « ${jobName} ». ${extra}\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\n${owner}\n${company}`,
  };
}

/** Envoi d'un document ou d'une relance : e-mail, WhatsApp, SMS ou partage natif (PDF joint). */
export function SendDialog({ doc, reminderStep, onClose }: { doc: Doc; reminderStep?: number; onClose: () => void }) {
  const { data, logSend } = useAppData();
  const { make } = usePdf();
  const job = data.jobs.find((j) => j.id === doc.jobId)!;
  const c = data.company;
  const initial = useMemo(
    () => (reminderStep !== undefined ? reminderMessage(reminderStep, doc, job, c) : documentMessage(doc, job.name, job.client, c.owner || c.name, c.name)),
    [doc, job, c, reminderStep],
  );
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [done, setDone] = useState<string[]>([]);
  const kind = reminderStep !== undefined ? "reminder" : "document";
  const pdf = useMemo(() => make(doc), [make, doc]);
  const shareable = canShareFiles(pdf.file);

  const record = (channel: "email" | "whatsapp" | "sms" | "share" | "download") => {
    logSend(doc.id, { channel, kind, step: reminderStep });
    setDone((d) => [...d, channel]);
  };

  const via = (channel: "email" | "whatsapp" | "sms") => {
    // Le PDF est téléchargé pour être joint : un lien mailto / WhatsApp ne peut pas porter de pièce jointe.
    downloadBlob(pdf.blob, pdf.name);
    openChannel(channel, { email: job.clientEmail, phone: job.clientPhone }, subject, channel === "email" ? body : `${body}\n\n(PDF : ${pdf.name})`);
    record(channel);
  };

  const buttons = [
    { id: "email" as const, label: "E-mail", icon: Mail, disabled: !job.clientEmail, hint: job.clientEmail || "E-mail du client manquant", run: () => via("email") },
    { id: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle, disabled: !job.clientPhone, hint: job.clientPhone || "Téléphone manquant", run: () => via("whatsapp") },
    { id: "sms" as const, label: "SMS", icon: Smartphone, disabled: !job.clientPhone, hint: job.clientPhone || "Téléphone manquant", run: () => via("sms") },
  ];

  return (
    <Modal title={reminderStep !== undefined ? `Relance — facture ${doc.number}` : `Envoyer ${docTitle(doc).toLowerCase()} ${doc.number}`} onClose={onClose} footer={<button onClick={onClose} className="btn-ghost text-sm">Fermer</button>}>
      <div className="space-y-4">
        <Field label="Objet">
          <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea className={cn(inputClass, "resize-y")} rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        {shareable && (
          <button
            onClick={async () => {
              try {
                await shareFile(pdf.file, subject, body);
                record("share");
              } catch {}
            }}
            className="btn-primary w-full text-sm"
          >
            <Share2 className="h-4 w-4" /> Partager avec le PDF joint (WhatsApp, e-mail, SMS…)
          </button>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {buttons.map((b) => (
            <button key={b.id} onClick={b.run} disabled={b.disabled} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan/50 disabled:cursor-not-allowed disabled:opacity-40">
              <span className="flex items-center gap-2">
                <b.icon className="h-4 w-4 text-cyan" /> {b.label}
                {done.includes(b.id) && <CheckCircle2 className="h-4 w-4 text-emerald" />}
              </span>
              <span className="max-w-full truncate text-[11px] font-normal text-slate-500">{b.hint}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            downloadBlob(pdf.blob, pdf.name);
            record("download");
          }}
          className="btn-ghost w-full text-sm"
        >
          <Download className="h-4 w-4" /> Télécharger le PDF
        </button>

        <Notice>
          {shareable
            ? "« Partager » ouvre vos applications (WhatsApp, Mail…) avec le PDF déjà joint."
            : "E-mail, WhatsApp et SMS s'ouvrent avec le message prêt ; le PDF est téléchargé en même temps pour que vous le joigniez."}{" "}
          Chaque envoi est enregistré dans l&apos;historique du document.
        </Notice>
        {doc.sends.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Historique</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {[...doc.sends].reverse().map((s, i) => (
                <li key={i}>
                  {new Date(s.at).toLocaleString("fr-FR")} — {s.kind === "reminder" ? `relance ${(s.step ?? 0) + 1}` : "document"} via {s.channel}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
