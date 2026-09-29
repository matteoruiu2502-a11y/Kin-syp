"use client";

// État de l'espace artisan : compte connecté + toutes ses données, enregistrées dans IndexedDB.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { idbDel, idbGet, idbSet } from "./db";
import { currentAccount, setSession } from "./auth";
import { DEMO_ID, buildDemoData } from "./demo";
import { addDays, emptyAccountData, newDoc, nextNumber, todayIso, uid } from "./defaults";
import { computeTotals } from "./money";
import type { Account, AccountData, Branding, Company, Doc, Expense, Job, Line, Photo, PhotoPhase, SendLog, Settings } from "./types";

type Ctx = {
  account: Account | null;
  data: AccountData | null;
  loading: boolean;
  signedIn: (a: Account) => Promise<void>;
  logOut: () => void;
  isDemo: boolean;
  resetDemo: () => Promise<void>;
  updateCompany: (c: Company) => void;
  updateBranding: (b: Branding) => void;
  updateSettings: (s: Partial<Settings>) => void;
  saveJob: (job: Job) => void;
  removeJob: (id: string) => { ok: boolean; reason?: string };
  saveDoc: (doc: Doc) => void;
  removeDoc: (id: string) => { ok: boolean; reason?: string };
  createQuote: (jobId: string, lines?: Line[]) => Doc;
  quoteToInvoice: (quoteId: string, kind: Doc["kind"]) => Doc;
  issueInvoice: (id: string) => Doc | null;
  creditNote: (invoiceId: string) => Doc | null;
  markPaid: (id: string, date: string, method: string) => void;
  logSend: (id: string, log: Omit<SendLog, "at">) => void;
  addPhotos: (jobId: string, phase: PhotoPhase, files: File[]) => Promise<void>;
  updatePhoto: (p: Photo) => void;
  removePhoto: (id: string) => void;
  blobUrl: (key: string) => Promise<string | null>;
  saveExpense: (e: Expense, receipt?: Blob | null) => Promise<void>;
  removeExpense: (id: string) => void;
};

const AppContext = createContext<Ctx | null>(null);
const dataKey = (accountId: string) => `data:${accountId}`;

/** Réduit une photo (max 2000 px, JPEG) pour garder un stockage léger et des PDF rapides. */
export async function compressImage(file: Blob, max = 2000, quality = 0.85): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  return { blob, width, height };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const urlCache = useRef(new Map<string, string>());

  const load = useCallback(async (a: Account) => {
    let stored = await idbGet<AccountData>(dataKey(a.id));
    if (!stored && a.id === DEMO_ID) {
      stored = await buildDemoData();
      await idbSet(dataKey(a.id), stored);
    }
    const base = emptyAccountData(a.email);
    // Fusion avec les valeurs par défaut : les anciens comptes récupèrent les nouveaux champs
    setData(stored ? { ...base, ...stored, company: { ...base.company, ...stored.company }, settings: { ...base.settings, ...stored.settings } } : base);
    setAccount(a);
  }, []);

  useEffect(() => {
    currentAccount()
      .then((a) => (a ? load(a) : undefined))
      .finally(() => setLoading(false));
  }, [load]);

  // Sauvegarde automatique (regroupée)
  useEffect(() => {
    if (!account || !data) return;
    const id = setTimeout(() => void idbSet(dataKey(account.id), data), 250);
    return () => clearTimeout(id);
  }, [account, data]);

  const mutate = useCallback((fn: (d: AccountData) => AccountData) => setData((d) => (d ? fn(d) : d)), []);

  const ctx = useMemo<Ctx>(() => {
    return {
      account,
      data,
      loading,
      signedIn: load,
      isDemo: account?.id === DEMO_ID,
      resetDemo: async () => {
        const fresh = await buildDemoData();
        await idbSet(dataKey(DEMO_ID), fresh);
        setData(fresh);
      },
      logOut: () => {
        setSession(null);
        setAccount(null);
        setData(null);
      },
      updateCompany: (company) => mutate((d) => ({ ...d, company })),
      updateBranding: (branding) => mutate((d) => ({ ...d, branding })),
      updateSettings: (s) => mutate((d) => ({ ...d, settings: { ...d.settings, ...s } })),

      saveJob: (job) => mutate((d) => ({ ...d, jobs: d.jobs.some((j) => j.id === job.id) ? d.jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...d.jobs] })),
      removeJob: (id) => {
        if (data?.docs.some((x) => x.jobId === id && x.type !== "quote" && x.lockedAt))
          return { ok: false, reason: "Ce chantier contient des factures émises : elles doivent être conservées 10 ans (art. L123-22 du Code de commerce)." };
        mutate((d) => ({
          ...d,
          jobs: d.jobs.filter((j) => j.id !== id),
          docs: d.docs.filter((x) => x.jobId !== id),
          photos: d.photos.filter((p) => p.jobId !== id),
          expenses: d.expenses.filter((e) => e.jobId !== id),
        }));
        data?.photos.filter((p) => p.jobId === id).forEach((p) => void idbDel(`photo:${p.id}`));
        data?.expenses.filter((e) => e.jobId === id && e.receiptId).forEach((e) => void idbDel(`receipt:${e.receiptId}`));
        return { ok: true };
      },

      saveDoc: (doc) =>
        mutate((d) => {
          const existing = d.docs.find((x) => x.id === doc.id);
          if (existing?.lockedAt) return d; // facture émise : intangible
          const docs = existing ? d.docs.map((x) => (x.id === doc.id ? doc : x)) : [doc, ...d.docs];
          // Le montant et le statut du chantier suivent son devis
          const jobs = d.jobs.map((j) => {
            if (j.id !== doc.jobId || doc.type !== "quote") return j;
            const status = doc.status === "accepted" ? (j.status === "draft" || j.status === "sent" ? "accepted" : j.status) : doc.status === "sent" && j.status === "draft" ? "sent" : doc.status === "refused" ? "refused" : j.status;
            return { ...j, amount: computeTotals(doc).ht, status };
          });
          return { ...d, docs, jobs };
        }),
      removeDoc: (id) => {
        const doc = data?.docs.find((x) => x.id === id);
        if (doc?.lockedAt) return { ok: false, reason: "Une facture émise ne peut pas être supprimée : établissez un avoir." };
        mutate((d) => ({ ...d, docs: d.docs.filter((x) => x.id !== id) }));
        return { ok: true };
      },

      createQuote: (jobId, lines = []) => {
        const d = data!;
        const { number, counters } = nextNumber(d.settings, "quote");
        const created = newDoc({
          jobId,
          type: "quote",
          number,
          lines,
          depositPercent: d.settings.depositPercent,
          validUntil: addDays(todayIso(), d.settings.quoteValidityDays),
        });
        mutate((cur) => ({ ...cur, settings: { ...cur.settings, counters: { ...cur.settings.counters, ...counters } }, docs: [created, ...cur.docs] }));
        return created;
      },
      quoteToInvoice: (quoteId, kind) => {
        const d = data!;
        const q = d.docs.find((x) => x.id === quoteId)!;
        const totals = computeTotals(q);
        const deposits = d.docs.filter((x) => x.sourceId === quoteId && x.type === "invoice" && x.kind === "deposit" && (x.status === "issued" || x.status === "paid"));
        const paidBefore = deposits.reduce((s, x) => s + computeTotals(x).ttc, 0);
        const lines: Line[] =
          kind === "deposit"
            ? q.lines.length
              ? // Facture d'acompte : une ligne par taux de TVA, au prorata de l'acompte
                computeTotals(q).vatByRate.map((v) => ({ id: uid(), label: `Acompte de ${q.depositPercent} % sur devis ${q.number}`, qty: 1, unit: "forfait", unitPrice: Math.round(v.base * q.depositPercent) / 100, vat: v.rate }))
              : []
            : q.lines.map((l) => ({ ...l, id: uid() }));
        const created = newDoc({
          jobId: q.jobId,
          type: "invoice",
          kind,
          lines,
          sourceId: quoteId,
          paidBefore: kind === "balance" ? Math.round(paidBefore * 100) / 100 : 0,
          dueDate: addDays(todayIso(), kind === "deposit" ? 0 : d.settings.paymentTermsDays),
          notes: kind === "balance" && totals.ttc ? `Facture de solde du devis ${q.number}.` : q.notes,
        });
        mutate((cur) => ({ ...cur, docs: [created, ...cur.docs] }));
        return created;
      },

      issueInvoice: (id) => {
        const d = data!;
        const doc = d.docs.find((x) => x.id === id);
        if (!doc || doc.lockedAt) return null;
        const { number, counters } = nextNumber(d.settings, doc.type);
        const issued: Doc = { ...doc, number, status: "issued", issueDate: todayIso(), lockedAt: new Date().toISOString() };
        mutate((cur) => ({
          ...cur,
          settings: { ...cur.settings, counters: { ...cur.settings.counters, ...counters } },
          docs: cur.docs.map((x) => (x.id === id ? issued : doc.type === "credit" && x.id === doc.sourceId ? { ...x, status: "cancelled" as const } : x)),
        }));
        return issued;
      },

      creditNote: (invoiceId) => {
        const d = data!;
        const inv = d.docs.find((x) => x.id === invoiceId);
        if (!inv?.lockedAt) return null;
        const created = newDoc({ jobId: inv.jobId, type: "credit", lines: inv.lines.map((l) => ({ ...l, id: uid() })), sourceId: inv.id, notes: `Avoir annulant la facture ${inv.number}.` });
        mutate((cur) => ({ ...cur, docs: [created, ...cur.docs] }));
        return created;
      },

      markPaid: (id, date, method) =>
        mutate((d) => ({
          ...d,
          docs: d.docs.map((x) => (x.id === id ? { ...x, status: "paid", paidAt: date, paymentMethod: method } : x)),
        })),

      logSend: (id, log) =>
        mutate((d) => ({
          ...d,
          docs: d.docs.map((x) => {
            if (x.id !== id) return x;
            const sends = [...x.sends, { ...log, at: new Date().toISOString() }];
            const status = x.type === "quote" && x.status === "draft" && log.kind === "document" ? "sent" : x.status;
            return { ...x, sends, status };
          }),
          jobs: d.jobs.map((j) => {
            const doc = d.docs.find((x) => x.id === id);
            return doc?.type === "quote" && doc.jobId === j.id && j.status === "draft" && log.kind === "document" ? { ...j, status: "sent" } : j;
          }),
        })),

      addPhotos: async (jobId, phase, files) => {
        const added: Photo[] = [];
        for (const file of files) {
          const { blob, width, height } = await compressImage(file);
          const photo: Photo = { id: uid(), jobId, phase, caption: "", takenAt: new Date(file.lastModified || Date.now()).toISOString(), addedAt: new Date().toISOString(), width, height };
          await idbSet(`photo:${photo.id}`, blob);
          added.push(photo);
        }
        mutate((d) => ({ ...d, photos: [...d.photos, ...added] }));
      },
      updatePhoto: (p) => mutate((d) => ({ ...d, photos: d.photos.map((x) => (x.id === p.id ? p : x)) })),
      removePhoto: (id) => {
        void idbDel(`photo:${id}`);
        mutate((d) => ({ ...d, photos: d.photos.filter((x) => x.id !== id) }));
      },
      blobUrl: async (key) => {
        const cache = urlCache.current;
        if (cache.has(key)) return cache.get(key)!;
        const blob = await idbGet<Blob>(key);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        cache.set(key, url);
        return url;
      },

      saveExpense: async (e, receipt) => {
        let expense = e;
        if (receipt) {
          const id = e.receiptId ?? uid();
          const { blob } = await compressImage(receipt, 1600, 0.8);
          await idbSet(`receipt:${id}`, blob);
          urlCache.current.delete(`receipt:${id}`);
          expense = { ...e, receiptId: id };
        }
        mutate((d) => ({ ...d, expenses: d.expenses.some((x) => x.id === expense.id) ? d.expenses.map((x) => (x.id === expense.id ? expense : x)) : [expense, ...d.expenses] }));
      },
      removeExpense: (id) =>
        mutate((d) => {
          const e = d.expenses.find((x) => x.id === id);
          if (e?.receiptId) void idbDel(`receipt:${e.receiptId}`);
          return { ...d, expenses: d.expenses.filter((x) => x.id !== id) };
        }),
    };
  }, [account, data, loading, load, mutate]);

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Raccourci : données garanties (écrans affichés une fois connecté). */
export function useAppData() {
  const app = useApp();
  return { ...app, data: app.data! };
}
