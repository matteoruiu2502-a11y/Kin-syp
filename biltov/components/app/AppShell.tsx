"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, FileText, HardHat, LayoutDashboard, Loader2, LogOut, Settings, ShieldCheck } from "lucide-react";
import { AppProvider, useApp, useAppData } from "@/lib/app/store";
import { missingCompanyFields } from "@/lib/app/legal";
import { paymentConfigured, readSubscription, trialHref } from "@/lib/checkout";
import { dueReminders } from "@/lib/app/reminders";
import { cn } from "@/lib/utils";
import { BiltovLogo } from "../BiltovLogo";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { OverviewTab } from "./OverviewTab";
import { JobsTab } from "./JobsTab";
import { JobDetail } from "./JobDetail";
import { InvoicesTab } from "./InvoicesTab";
import { SettingsTab } from "./SettingsTab";
import { JobForm } from "./JobForm";
import { DocEditor } from "./DocEditor";

type Tab = "overview" | "jobs" | "invoices" | "settings";
type Route = { tab: Tab; jobId?: string };

const parse = (hash: string): Route => {
  const [a, b] = hash.replace(/^#/, "").split("/");
  if (a === "chantier" && b) return { tab: "jobs", jobId: b };
  return { tab: ({ chantiers: "jobs", factures: "invoices", parametres: "settings" } as Record<string, Tab>)[a] ?? "overview" };
};
const toHash = (r: Route) => (r.jobId ? `#chantier/${r.jobId}` : { overview: "#apercu", jobs: "#chantiers", invoices: "#factures", settings: "#parametres" }[r.tab]);

export function App() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}

/** Compte obligatoire, puis informations légales, puis tableau de bord. */
function Gate() {
  const { account, data, loading } = useApp();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan" />
      </div>
    );
  if (!account || !data) return <AuthScreen />;
  if (!data.company.name || !data.company.siret) return <Onboarding />;
  return <Shell />;
}

function Shell() {
  const { data, account, logOut } = useAppData();
  const [route, setRoute] = useState<Route>({ tab: "overview" });
  const [subscribed, setSubscribed] = useState(false);
  const [newJob, setNewJob] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);

  useEffect(() => {
    setSubscribed(readSubscription());
    const sync = () => setRoute(parse(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = useCallback((r: Route) => {
    window.history.pushState(null, "", toHash(r));
    setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const back = () => setRoute(parse(window.location.hash));
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);

  const job = route.jobId ? data.jobs.find((j) => j.id === route.jobId) : undefined;
  const reminders = dueReminders(data.docs, data.jobs).length;
  const incomplete = missingCompanyFields(data.company).length > 0;

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: "overview", label: "Aperçu", icon: LayoutDashboard },
    { id: "jobs", label: "Chantiers & devis", icon: HardHat },
    { id: "invoices", label: "Factures", icon: FileText, badge: reminders || undefined },
    { id: "settings", label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="relative min-h-screen pb-24 md:pb-0">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-50" aria-hidden />
      <div className="pointer-events-none fixed -left-40 top-0 -z-10 h-[480px] w-[480px] rounded-full bg-blue/15 blur-[140px]" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Biltov">
              <BiltovLogo size={30} />
            </Link>
            <span className="hidden h-6 w-px bg-white/10 sm:block" />
            <span className="hidden truncate text-sm font-semibold text-slate-300 sm:block">{data.company.name}</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation">
            {tabs.map(({ id, label, icon: Icon, badge }) => (
              <button key={id} onClick={() => go({ tab: id })} className={cn("relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors", route.tab === id ? "text-white" : "text-slate-400 hover:text-white")}>
                {route.tab === id && <motion.span layoutId="app-tab" className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" />}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
                {badge && <span className="relative rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-ink">{badge}</span>}
              </button>
            ))}
          </nav>
          <button onClick={logOut} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white" title={`Se déconnecter (${account?.email})`}>
            <LogOut className="h-4 w-4" /> <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Navigation mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-ink/95 backdrop-blur-xl md:hidden" aria-label="Navigation">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => go({ tab: id })} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", route.tab === id ? "text-cyan" : "text-slate-500")}>
            <Icon className="h-5 w-5" />
            {label.split(" ")[0]}
            {badge && <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-amber-400" />}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {!subscribed && (
          <div className="glow-border mb-6 flex flex-col gap-3 rounded-2xl bg-gradient-to-r from-blue/15 to-emerald/10 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-3 text-slate-300">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
              <span>
                <strong className="text-white">Essai gratuit d&apos;1 jour.</strong> Enregistrez votre carte pour continuer ensuite : 80 € HT / mois prélevés automatiquement, résiliable à tout moment.
                {!paymentConfigured && <span className="mt-1 block text-xs text-amber-300">Mode démonstration : le lien de paiement Stripe n&apos;est pas encore configuré.</span>}
              </span>
            </p>
            {paymentConfigured && (
              <a href={trialHref()} className="btn-primary shrink-0 !py-2 text-sm">
                Enregistrer ma carte
              </a>
            )}
          </div>
        )}
        {subscribed && (
          <p className="mb-6 flex items-center gap-2 text-sm text-emerald">
            <ShieldCheck className="h-4 w-4" /> Abonnement actif — prélèvement automatique.
          </p>
        )}
        {incomplete && route.tab !== "settings" && (
          <button onClick={() => go({ tab: "settings" })} className="mb-6 w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-left text-sm text-amber-200">
            Mentions légales incomplètes (assurance décennale, TVA…) : complétez vos paramètres pour envoyer des devis conformes →
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div key={route.tab + (route.jobId ?? "")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {route.tab === "overview" && <OverviewTab onAdd={() => setNewJob(true)} onOpenJob={(id) => go({ tab: "jobs", jobId: id })} go={(tab) => go({ tab })} />}
            {route.tab === "jobs" && !job && <JobsTab onOpen={(id) => go({ tab: "jobs", jobId: id })} onAdd={() => setNewJob(true)} />}
            {route.tab === "jobs" && job && <JobDetail job={job} onBack={() => go({ tab: "jobs" })} onOpenDoc={setDocId} />}
            {route.tab === "invoices" && <InvoicesTab onOpenDoc={setDocId} />}
            {route.tab === "settings" && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {newJob && (
          <JobForm
            job={null}
            onClose={() => setNewJob(false)}
            onSaved={(j, quoteId) => {
              setNewJob(false);
              go({ tab: "jobs", jobId: j.id });
              if (quoteId) setDocId(quoteId);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{docId && <DocEditor key={docId} docId={docId} onClose={() => setDocId(null)} onOpen={setDocId} />}</AnimatePresence>
    </div>
  );
}
