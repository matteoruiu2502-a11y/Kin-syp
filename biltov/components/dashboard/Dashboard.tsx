"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CreditCard, HardHat, Info, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useJobs, type Job } from "@/lib/jobs";
import { paymentConfigured, readSubscription, trialHref } from "@/lib/checkout";
import { cn } from "@/lib/utils";
import { BiltovLogo } from "../BiltovLogo";
import { LangSwitch } from "../LangSwitch";
import { Overview } from "./Overview";
import { JobsList } from "./JobsList";
import { JobForm } from "./JobForm";

type Tab = "overview" | "jobs";
const TAB_HASH: Record<Tab, string> = { overview: "#apercu", jobs: "#chantiers" };

export function Dashboard() {
  const { t } = useI18n();
  const d = t.dashboard;
  const store = useJobs();
  const [tab, setTab] = useState<Tab>("overview");
  const [subscribed, setSubscribed] = useState(false);
  const [editing, setEditing] = useState<Job | "new" | null>(null);

  useEffect(() => {
    setSubscribed(readSubscription());
    const fromHash = () => setTab(window.location.hash === TAB_HASH.jobs ? "jobs" : "overview");
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (next: Tab) => {
    setTab(next);
    window.history.replaceState(null, "", TAB_HASH[next]);
    window.scrollTo({ top: 0 });
  };

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: d.tabs.overview, icon: LayoutDashboard },
    { id: "jobs", label: d.tabs.jobs, icon: HardHat },
  ];

  return (
    <div className="relative min-h-screen">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-60" aria-hidden />
      <div className="pointer-events-none fixed -left-40 top-0 -z-10 h-[480px] w-[480px] rounded-full bg-blue/15 blur-[140px]" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Biltov">
              <BiltovLogo size={30} />
            </Link>
            <span className="hidden h-6 w-px bg-white/10 sm:block" />
            <span className="hidden font-display text-sm font-bold text-slate-300 sm:block">{d.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <LangSwitch id="dash-lang" />
            <Link href="/" className="btn-ghost !px-3 !py-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden md:inline">{d.back}</span>
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6" role="tablist" aria-label={d.title}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => go(id)}
              className={cn("relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors", tab === id ? "text-white" : "text-slate-400 hover:text-white")}
            >
              <Icon className="h-4 w-4" /> {label}
              {tab === id && <motion.span layoutId="dash-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-blue to-emerald" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <TrialBanner subscribed={subscribed} />

        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            {tab === "overview" ? (
              <Overview jobs={store.jobs} onSeeAll={() => go("jobs")} onOpen={(job) => setEditing(job)} onAdd={() => setEditing("new")} />
            ) : (
              <JobsList jobs={store.jobs} ready={store.ready} onAdd={() => setEditing("new")} onEdit={setEditing} onSave={store.save} onRemove={store.remove} onResetDemo={store.resetDemo} />
            )}
          </motion.div>
        </AnimatePresence>

        <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <Info className="h-3.5 w-3.5" /> {d.storageNote}
        </p>
      </main>

      <AnimatePresence>
        {editing && (
          <JobForm
            job={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSave={(job) => {
              store.save(job);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function TrialBanner({ subscribed }: { subscribed: boolean }) {
  const { t } = useI18n();
  const tr = t.dashboard.trial;

  if (subscribed)
    return (
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald/30 bg-emerald/10 px-5 py-4 text-sm">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald" />
        <p>
          <strong className="text-emerald">{tr.active}</strong> <span className="text-slate-300">— {tr.activeDesc}</span>
        </p>
      </div>
    );

  return (
    <div className="glow-border mb-8 flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-blue/15 to-emerald/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
        <div className="text-sm">
          <p className="font-semibold text-white">{tr.title}</p>
          <p className="text-slate-300">{tr.desc}</p>
          {!paymentConfigured && <p className="mt-1 text-xs text-amber-300">{tr.demo}</p>}
        </div>
      </div>
      {paymentConfigured && (
        <a href={trialHref()} className="btn-primary shrink-0 text-sm">
          <CreditCard className="h-4 w-4" /> {tr.cta}
        </a>
      )}
    </div>
  );
}
