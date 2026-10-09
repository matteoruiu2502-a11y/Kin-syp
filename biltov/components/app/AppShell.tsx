"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Blocks,
  Building2,
  Boxes,
  Car,
  Repeat,
  Wrench,
  Handshake,
  Calculator,
  Landmark,
  CreditCard,
  FileText,
  HardHat,
  HandCoins,
  Loader2,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  UserCog,
  Users,
  CalendarDays,
  Contact,
  Compass,
  BookOpen,
  LifeBuoy,
  Eye,
  Lock,
  X,
} from "lucide-react";
import { AppProvider, useApp, useAppData } from "@/lib/app/store";
import { TrProvider, useTr } from "@/lib/app/tr";
import { PRICE_MONTHLY, PRICE_YEARLY, TRIAL_DAYS, paymentConfigured, readSubscription, subscribeHref, trialDaysLeft } from "@/lib/checkout";
import { Field, Modal, Notice, ReadOnlyContext, inputClass } from "./ui";
import { dueReminders } from "@/lib/app/reminders";
import { MODULES } from "@/lib/app/labels";
import type { Lang, Member, ModuleId, PermModule } from "@/lib/app/types";
import { PERM_LABEL, PERM_MODULES, docVisible, isSuperAdmin, workerOnly } from "@/lib/app/permissions";
import { logIn } from "@/lib/app/auth";
import { openHelp } from "@/lib/help";
import { cn } from "@/lib/utils";
import { BiltovLogo } from "../BiltovLogo";
import { ThemeToggle } from "../ThemeToggle";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { companyMissing } from "./CompanyForm";
import { MoneyTab } from "./MoneyTab";
import { WorkerLogin, WorkerMode } from "./WorkerMode";
import { VOICE_EVENT, VoiceQuoteButton, VoiceQuoteChat } from "./VoiceQuoteChat";
import { BackToBuilding, Building3D, Mode3DNotice, Mode3DToggle, useMode3D } from "@/mode-3d";

// Chaque page de l'espace artisan est chargée à la demande : l'ouverture de l'app est plus rapide sur téléphone.
function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-label="Chargement">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40" />
    </div>
  );
}
const JobsTab = dynamic(() => import("./JobsTab").then((m) => m.JobsTab), { ssr: false, loading: PageLoading });
const JobDetail = dynamic(() => import("./JobDetail").then((m) => m.JobDetail), { ssr: false, loading: PageLoading });
const DocsTab = dynamic(() => import("./DocsTab").then((m) => m.DocsTab), { ssr: false, loading: PageLoading });
const CatalogTab = dynamic(() => import("./CatalogTab").then((m) => m.CatalogTab), { ssr: false, loading: PageLoading });
const PlanningTab = dynamic(() => import("./PlanningTab").then((m) => m.PlanningTab), { ssr: false, loading: PageLoading });
const TeamTab = dynamic(() => import("./TeamTab").then((m) => m.TeamTab), { ssr: false, loading: PageLoading });
const PurchasesTab = dynamic(() => import("./PurchasesTab").then((m) => m.PurchasesTab), { ssr: false, loading: PageLoading });
const StockTab = dynamic(() => import("./StockTab").then((m) => m.StockTab), { ssr: false, loading: PageLoading });
const FleetTab = dynamic(() => import("./FleetTab").then((m) => m.FleetTab), { ssr: false, loading: PageLoading });
const ContractsTab = dynamic(() => import("./ContractsTab").then((m) => m.ContractsTab), { ssr: false, loading: PageLoading });
const ToolsTab = dynamic(() => import("./ToolsTab").then((m) => m.ToolsTab), { ssr: false, loading: PageLoading });
const SubcontractorsTab = dynamic(() => import("./SubcontractorsTab").then((m) => m.SubcontractorsTab), { ssr: false, loading: PageLoading });
const AccountingTab = dynamic(() => import("./AccountingTab").then((m) => m.AccountingTab), { ssr: false, loading: PageLoading });
const BankTab = dynamic(() => import("./BankTab").then((m) => m.BankTab), { ssr: false, loading: PageLoading });
const ModulesTab = dynamic(() => import("./ModulesTab").then((m) => m.ModulesTab), { ssr: false, loading: PageLoading });
const SettingsTab = dynamic(() => import("./SettingsTab").then((m) => m.SettingsTab), { ssr: false, loading: PageLoading });
const JobForm = dynamic(() => import("./JobForm").then((m) => m.JobForm), { ssr: false, loading: PageLoading });
const DocEditor = dynamic(() => import("./DocEditor").then((m) => m.DocEditor), { ssr: false, loading: PageLoading });
const ClientsTab = dynamic(() => import("./ClientsTab").then((m) => m.ClientsTab), { ssr: false, loading: PageLoading });
const ClientDetail = dynamic(() => import("./ClientsTab").then((m) => m.ClientDetail), { ssr: false, loading: PageLoading });

type Page = "batiment" | "apercu" | "chantiers" | "chantier" | "clients" | "client" | "documents" | "catalogue" | "planning" | "equipe" | "achats" | "stock" | "flotte" | "banque" | "comptabilite" | "sous-traitants" | "outils" | "contrats" | "modules" | "module" | "parametres" | "mon-espace";
type Route = { page: Page; id?: string; sub?: string };

const PAGES: Page[] = ["batiment", "apercu", "chantiers", "chantier", "clients", "client", "documents", "catalogue", "planning", "equipe", "achats", "stock", "flotte", "banque", "comptabilite", "sous-traitants", "outils", "contrats", "modules", "module", "parametres", "mon-espace"];
const parse = (hash: string): Route => {
  const [a, b, c] = hash.replace(/^#/, "").split("/");
  const page = (PAGES as string[]).includes(a) ? (a as Page) : "apercu";
  if ((page === "chantier" || page === "client" || page === "module") && !b) return { page: page === "chantier" ? "chantiers" : page === "client" ? "clients" : "modules" };
  return { page, id: b, sub: c };
};
const toHash = (r: Route) => `#${r.page}${r.id ? `/${r.id}` : ""}${r.sub ? `/${r.sub}` : ""}`;

/** Pages accessibles selon le rôle de la personne connectée sur l'appareil. */
/** Module de droits qui ouvre chaque page (au moins un en lecture). */
const PAGE_MODULES: Record<Page, PermModule[]> = {
  batiment: PERM_MODULES, // mode 3D : la scène elle-même ; chaque pièce vérifie ses propres droits
  apercu: ["money"],
  chantiers: ["jobs"],
  chantier: ["jobs"],
  clients: ["clients"],
  client: ["clients"],
  documents: ["quotes", "invoices"],
  catalogue: ["catalog"],
  planning: ["planning"],
  equipe: ["team", "time"],
  achats: ["purchases"],
  stock: ["stock"],
  flotte: ["fleet"],
  banque: ["bank"],
  comptabilite: ["accounting"],
  "sous-traitants": ["subcontractors"],
  outils: ["tools"],
  contrats: ["contracts"],
  modules: ["modules"],
  module: ["modules"],
  parametres: ["settings"],
  "mon-espace": ["worker"],
};

/** Installation sur l'écran d'accueil et fonctionnement hors ligne (production uniquement). */
function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/sw.js`, { updateViaCache: "none" })
      .then((r) => r.update())
      .catch(() => {});
  }, []);
}

export function App() {
  useServiceWorker();
  return (
    <TrProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </TrProvider>
  );
}

/** Compte obligatoire (ou démo), puis identité de l'entreprise, puis tableau de bord. */
function Gate() {
  const { account, data, loading } = useApp();
  if (loading)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-cyan" />
      </div>
    );
  if (!account || !data) return <AuthScreen />;
  if (!data.company.name || !data.company.bce) return <Onboarding />;
  return <Shell />;
}

function LangSwitch() {
  const { lang, setLang } = useTr();
  return (
    <div className="flex rounded-lg border border-white/10 p-0.5 text-xs font-semibold">
      {(["fr", "nl", "de"] as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={cn("rounded-md px-2 py-1", lang === l ? "bg-white/10 text-white" : "text-slate-500 hover:text-white")}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function GlobalSearch({ go, openDoc }: { go: (r: Route) => void; openDoc: (id: string) => void }) {
  const { t } = useTr();
  const { data, can, perms } = useAppData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const s = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (s.length < 2) return [];
    const has = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(s));
    return [
      ...data.clients.filter(() => can("clients")).filter((c) => has(c.name, c.email, c.phone, c.bce, c.billing.city)).slice(0, 5).map((c) => ({ key: c.id, label: c.name, sub: t("Client"), act: () => go({ page: "client", id: c.id }) })),
      ...data.jobs.filter(() => can("jobs")).filter((j) => has(j.name, j.siteAddress)).slice(0, 5).map((j) => ({ key: j.id, label: j.name, sub: t("Chantier"), act: () => go({ page: "chantier", id: j.id }) })),
      ...data.docs.filter(docVisible(perms)).filter((d) => d.number && has(d.number, d.structuredComm)).slice(0, 5).map((d) => ({ key: d.id, label: d.number!, sub: data.clients.find((c) => c.id === d.clientId)?.name ?? "", act: () => openDoc(d.id) })),
    ];
  }, [s, data, go, openDoc, t, can, perms]);
  return (
    <div className="relative hidden w-72 lg:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t("Rechercher… (Ctrl K)")}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan"
      />
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-ink shadow-2xl">
          {results.map((r) => (
            <li key={r.key}>
              <button onMouseDown={() => (r.act(), setQ(""))} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-white/5">
                <span className="truncate text-slate-100">{r.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Shell() {
  const { t } = useTr();
  const { data, account, logOut, isDemo, resetDemo, actor: member, setActor, perms, can: canModule, denied, clearDenied } = useAppData();
  const [route, setRoute] = useState<Route>({ page: "apercu" });
  const [subscribed, setSubscribed] = useState(false);
  const [newJob, setNewJob] = useState<{ clientId?: string } | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [voice, setVoice] = useState(false);
  const m3d = useMode3D(account?.id ?? "", member?.id ?? null);

  // mode 3D mémorisé : l'application s'ouvre sur le bâtiment (sauf adresse précise demandée)
  useEffect(() => {
    if (m3d.on && !window.location.hash) {
      window.history.replaceState(null, "", "#batiment");
      setRoute({ page: "batiment" });
    }
  }, [m3d.on]);

  // « Dictée vocale » ouverte depuis n'importe quel écran
  useEffect(() => {
    const open = () => setVoice(true);
    window.addEventListener(VOICE_EVENT, open);
    return () => window.removeEventListener(VOICE_EVENT, open);
  }, []);

  useEffect(() => {
    setSubscribed(readSubscription());
    const sync = () => setRoute(parse(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  const go = useCallback((r: Route) => {
    window.history.pushState(null, "", toHash(r));
    setRoute(r);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, []);
  const goPage = useCallback((p: string) => go(parse(`#${p}`)), [go]);

  const enter = (m: Member | null) => {
    setActor(m?.id ?? null);
    setSwitching(false);
    go({ page: "apercu" });
  };

  // le message de refus disparaît seul
  useEffect(() => {
    if (!denied) return;
    const id = setTimeout(clearDenied, 6000);
    return () => clearTimeout(id);
  }, [denied, clearDenied]);

  const trialLeft = account ? trialDaysLeft(account.createdAt) : TRIAL_DAYS;
  const trialOver = !isDemo && !subscribed && trialLeft === 0;
  const mods = data.settings.modules;
  const reminders = dueReminders(data).length;
  const superAdmin = isSuperAdmin(member);
  const can = (p: Page) => (p === "batiment" ? m3d.on : p === "mon-espace" ? !superAdmin && canModule("worker") : PAGE_MODULES[p].some((m) => canModule(m)));
  const canEdit = (p: Page) => PAGE_MODULES[p].some((m) => canModule(m, "edit"));

  const nav: { page: Page; label: string; icon: typeof HardHat; badge?: number; on: boolean; group: 0 | 1 | 2 | 3 }[] = [
    { page: "batiment", label: t("Bâtiment"), icon: Building2, on: m3d.on, group: 0 },
    { page: "apercu", label: t("Argent à recevoir"), icon: HandCoins, badge: reminders || undefined, on: true, group: 0 },
    { page: "chantiers", label: t("Chantiers"), icon: HardHat, on: true, group: 0 },
    { page: "clients", label: t("Clients"), icon: Contact, on: mods.clients, group: 0 },
    { page: "documents", label: t("Devis & factures"), icon: FileText, on: true, group: 0 },
    { page: "catalogue", label: t("Catalogue"), icon: Package, on: mods.catalog, group: 0 },
    { page: "planning", label: t("Planning"), icon: CalendarDays, on: mods.planning, group: 1 },
    { page: "equipe", label: t("Équipe"), icon: Users, on: mods.planning || mods.time || mods.expenses, group: 1 },
    { page: "achats", label: t("Achats"), icon: ShoppingCart, on: mods.purchases, group: 2 },
    { page: "stock", label: t("Stock"), icon: Boxes, on: mods.stock, group: 1 },
    { page: "flotte", label: t("Flotte"), icon: Car, on: mods.fleet, group: 1 },
    { page: "banque", label: t("Banque"), icon: Landmark, on: true, group: 2 },
    { page: "comptabilite", label: t("Comptabilité"), icon: Calculator, on: true, group: 2 },
    { page: "sous-traitants", label: t("Sous-traitants"), icon: Handshake, on: mods.purchases, group: 2 },
    { page: "outils", label: t("Outils"), icon: Wrench, on: true, group: 1 },
    { page: "contrats", label: t("Contrats"), icon: Repeat, on: true, group: 1 },
    { page: "mon-espace", label: t("Mon espace"), icon: HardHat, on: true, group: 3 },
    { page: "modules", label: t("Modules"), icon: Blocks, on: true, group: 3 },
    { page: "parametres", label: t("Paramètres"), icon: Settings, on: true, group: 3 },
  ];
  const visible = nav.filter((n) => n.on && can(n.page));
  const active = (p: Page) => route.page === p || (route.page === "chantier" && p === "chantiers") || (route.page === "client" && p === "clients") || (route.page === "module" && p === "modules");
  const job = route.page === "chantier" ? data.jobs.find((j) => j.id === route.id) : undefined;
  const client = route.page === "client" ? data.clients.find((c) => c.id === route.id) : undefined;
  // Page demandée sans droit (lien, favori, adresse tapée) : première page autorisée.
  const firstAllowed = visible[0]?.page ?? "apercu";
  const routeOk = can(route.page) && !(route.page === "chantier" && (route.sub === "rentabilite" || route.sub === "materiaux") && !canModule("profit"));
  const page: Page = routeOk ? route.page : firstAllowed;
  const readOnly = !superAdmin && page !== "mon-espace" && page !== "batiment" && !canEdit(page);
  // Mode 3D : accès à une page pour les pièces du bâtiment (mêmes droits et modules activés que le menu)
  const pageAccess = (p: string): "ok" | "locked" | "off" => {
    if (!(PAGES as string[]).includes(p)) return "off";
    const n = nav.find((x) => x.page === p);
    if (n && !n.on) return "off";
    return can(p as Page) ? "ok" : "locked";
  };
  const firstNormal = nav.find((n) => n.page !== "batiment" && n.on && can(n.page))?.page ?? "apercu";
  const switchMode = (v: boolean) => {
    if (m3d.setOn(v)) go({ page: v ? "batiment" : firstNormal });
  };
  // 3D désactivée (repli automatique, autre appareil…) alors que l'adresse est celle du bâtiment : page normale
  useEffect(() => {
    if (m3d.ready && !m3d.on && route.page === "batiment") {
      const next: Route = { page: member && workerOnly(perms) ? "mon-espace" : firstNormal };
      window.history.replaceState(null, "", toHash(next));
      setRoute(next);
    }
  }, [m3d.ready, m3d.on, route.page, firstNormal, member, perms]);

  if (member && !member.active)
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="card max-w-sm space-y-4 p-6 text-center">
          <p className="font-semibold text-white">{t("Cet utilisateur a été désactivé ou supprimé.")}</p>
          <p className="text-sm text-slate-400">{t("Le super admin doit se reconnecter avec son mot de passe.")}</p>
          <button onClick={logOut} className="btn-primary w-full text-sm">
            {t("Connexion du super admin")}
          </button>
        </div>
      </div>
    );

  if (member && workerOnly(perms))
    return (
      <div className="min-h-dvh px-4 py-6">
        <WorkerMode member={member} onExit={() => setSwitching(true)} />
        <AnimatePresence>{switching && <SwitchUser current={member} onPick={enter} onSuperAdmin={() => enter(null)} onClose={() => setSwitching(false)} />}</AnimatePresence>
      </div>
    );

  const NavList = ({ onPick }: { onPick?: () => void }) => (
    <nav className="space-y-5" aria-label={t("Navigation")}>
      {[0, 1, 2, 3].map((g) => (
        <div key={g} className="space-y-1">
          {visible
            .filter((n) => n.group === g)
            .map(({ page: p, label, icon: Icon, badge }) => (
              <button key={p} onClick={() => (go({ page: p }), onPick?.())} className={cn("relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors", active(p) ? "text-white" : "text-slate-400 hover:text-white")}>
                {active(p) && <motion.span layoutId="app-nav" className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" />}
                <Icon className="relative h-4 w-4" />
                <span className="relative flex-1 text-left">{label}</span>
                {badge && <span className="relative rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-ink">{badge}</span>}
              </button>
            ))}
        </div>
      ))}
      {/* Biltov : présentation, guide et aide restent accessibles une fois connecté */}
      <div className="space-y-1 border-t border-white/5 pt-4">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-400 hover:text-white">
          <Compass className="h-4 w-4" /> {t("Découvrir Biltov")}
        </Link>
        <Link href="/fonctionnalites/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-400 hover:text-white">
          <BookOpen className="h-4 w-4" /> {t("Fonctionnalités")}
        </Link>
        <button type="button" onClick={() => (openHelp(), onPick?.())} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-400 hover:text-white">
          <LifeBuoy className="h-4 w-4" /> {t("Aide")}
        </button>
      </div>
    </nav>
  );

  const openJob = (id: string) => go({ page: "chantier", id });
  const openClient = (id: string) => go({ page: "client", id });

  return (
    <div className="relative min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="bg-grid pointer-events-none fixed inset-0 -z-10 opacity-50" aria-hidden />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 text-slate-300 md:hidden" aria-label={t("Menu")}>
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" aria-label="Biltov" className="hidden min-[440px]:block">
              <BiltovLogo size={30} />
            </Link>
            <span className="hidden h-6 w-px bg-white/10 sm:block" />
            <span className="hidden truncate text-sm font-semibold text-slate-300 sm:block">{data.company.name}</span>
          </div>
          <GlobalSearch go={go} openDoc={setDocId} />
          <div className="flex items-center gap-1 sm:gap-2">
            <VoiceQuoteButton compact />
            <span className="hidden sm:block">
              <LangSwitch />
            </span>
            <Mode3DToggle on={m3d.on} onChange={switchMode} />
            <ThemeToggle labels={{ light: t("Mode jour"), dark: t("Mode nuit") }} />
            {data.members.length > 0 && (
              <button onClick={() => setSwitching(true)} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-slate-400 hover:text-white" title={t("Changer d'utilisateur sur cet appareil")}>
                <UserCog className="h-4 w-4" /> <span className="hidden lg:inline">{member?.name ?? t("Super admin")}</span>
              </button>
            )}
            <button onClick={logOut} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-slate-400 hover:text-white" title={`${t("Se déconnecter")} (${account?.email})`}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-[61px] hidden h-[calc(100dvh-61px)] w-60 shrink-0 overflow-y-auto border-r border-white/5 px-3 py-6 md:block">
          <NavList />
        </aside>

        <AnimatePresence>
          {drawer && (
            <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="absolute inset-0 bg-black/60" onClick={() => setDrawer(false)} />
              <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-white/10 bg-ink p-4">
                <div className="mb-6 flex items-center justify-between">
                  <BiltovLogo size={28} />
                  <button onClick={() => setDrawer(false)} className="p-1 text-slate-400" aria-label={t("Fermer")}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mb-5 sm:hidden">
                  <LangSwitch />
                </div>
                <NavList onPick={() => setDrawer(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {isDemo && (
            <div data-demo-banner className="mb-6 flex flex-col gap-3 rounded-2xl border border-blue/30 bg-blue/[0.06] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-slate-300">
                <strong className="text-cyan">{t("Mode démonstration")}</strong> — {t("entreprise et clients belges fictifs. Testez tout librement ; les PDF portent la mention « DÉMONSTRATION ».")}
              </p>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => window.confirm(t("Remettre la démo à zéro ?")) && void resetDemo()} className="btn-ghost !py-2 text-sm">
                  {t("Réinitialiser")}
                </button>
                <button onClick={logOut} className="btn-primary !py-2 text-sm">
                  {t("Créer mon vrai compte")}
                </button>
              </div>
            </div>
          )}
          {!isDemo && !subscribed && trialLeft > 0 && (
            <div className="glow-border mb-6 flex flex-col gap-3 rounded-2xl bg-blue/15 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-3 text-slate-300">
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
                <span>
                  <strong className="text-white">{trialLeft === 1 ? t("Essai gratuit : dernier jour.") : t("Essai gratuit : {n} jours restants.", { n: trialLeft })}</strong>{" "}
                  {t("Aucune carte demandée pendant l'essai. Pour continuer ensuite : {p} € HTVA / mois, résiliable à tout moment.", { p: PRICE_MONTHLY })}
                </span>
              </p>
              {subscribeHref() && (
                <a href={subscribeHref()!} className="btn-primary shrink-0 !py-2 text-sm">
                  {t("S'abonner")}
                </a>
              )}
            </div>
          )}
          {trialOver && !paymentConfigured && (
            <div className="mb-6">
              <Notice tone="warn">{t("L'essai gratuit est terminé. Le lien de paiement Stripe n'est pas encore configuré : l'accès reste ouvert en attendant.")}</Notice>
            </div>
          )}
          {subscribed && (
            <p className="mb-6 flex items-center gap-2 text-sm text-emerald">
              <ShieldCheck className="h-4 w-4" /> {t("Abonnement actif — prélèvement automatique.")}
            </p>
          )}
          {companyMissing(data.company) && page !== "parametres" && can("parametres") && (
            <button onClick={() => go({ page: "parametres" })} className="mb-6 w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-left text-sm text-amber-200">
              {t("Identité de l'entreprise incomplète (BCE, IBAN, adresse…) : complétez-la pour émettre des factures conformes →")}
            </button>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={page + (route.id ?? "")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              {trialOver && paymentConfigured && page !== "parametres" ? (
                <Paywall onBackup={() => go({ page: "parametres" })} />
              ) : (
              <ReadOnlyContext.Provider value={readOnly}>
              {readOnly && (
                <p className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300">
                  <Eye className="h-4 w-4 text-cyan" /> {t("Lecture seule : vous pouvez consulter cette page, pas la modifier.")}
                </p>
              )}
              {page !== "batiment" && m3d.on && <BackToBuilding onClick={() => go({ page: "batiment" })} />}
              {page === "batiment" && <Building3D access={pageAccess} onOpen={(target) => go(parse(`#${target}`))} onExit={() => switchMode(false)} onFallback={(r) => (m3d.fallback(r), go({ page: "apercu" }))} />}
              {page === "apercu" && <MoneyTab onOpenDoc={setDocId} onOpenJob={openJob} />}
              {page === "chantiers" && <JobsTab onOpen={openJob} onAdd={() => setNewJob({})} />}
              {page === "chantier" && (job ? <JobDetail key={job.id + (route.sub ?? "")} job={job} initialTab={route.sub === "rentabilite" ? "finance" : route.sub === "materiaux" ? "materials" : route.sub === "planning" ? "planning" : "docs"} onBack={() => go({ page: "chantiers" })} onOpenDoc={setDocId} onOpenClient={openClient} /> : <NotFound onBack={() => go({ page: "chantiers" })} />)}
              {page === "clients" && <ClientsTab onOpen={openClient} />}
              {page === "client" && (client ? <ClientDetail client={client} onBack={() => go({ page: "clients" })} onOpenJob={openJob} onOpenDoc={setDocId} onNewJob={(clientId) => setNewJob({ clientId })} /> : <NotFound onBack={() => go({ page: "clients" })} />)}
              {page === "documents" && <DocsTab onOpenDoc={setDocId} />}
              {page === "catalogue" && <CatalogTab />}
              {page === "planning" && <PlanningTab view={route.id} onView={(v) => go({ page: "planning", id: v === "agenda" ? undefined : v })} />}
              {page === "equipe" && <TeamTab />}
              {page === "achats" && <PurchasesTab />}
              {page === "stock" && <StockTab />}
              {page === "flotte" && <FleetTab />}
              {page === "banque" && <BankTab />}
              {page === "comptabilite" && <AccountingTab />}
              {page === "sous-traitants" && <SubcontractorsTab />}
              {page === "outils" && <ToolsTab />}
              {page === "contrats" && <ContractsTab onOpenDoc={setDocId} />}
              {(page === "modules" || page === "module") && <ModulesTab module={page === "module" && route.id && route.id in MODULES ? (route.id as ModuleId) : null} onOpen={(m) => go({ page: "module", id: m })} onBack={() => go({ page: "modules" })} go={goPage} onOpenJob={openJob} />}
              {page === "parametres" && <SettingsTab />}
              {page === "mon-espace" && member && <WorkerMode member={member} onExit={() => go({ page: firstAllowed })} />}
              </ReadOnlyContext.Provider>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Navigation mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label={t("Navigation")}>
        {visible
          .filter((n) => ["apercu", "chantiers", "documents"].includes(n.page))
          .map(({ page: p, label, icon: Icon, badge }) => (
            <button key={p} onClick={() => go({ page: p })} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold", active(p) ? "text-cyan" : "text-slate-500")}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{label}</span>
              {badge && <span className="absolute right-1/4 top-1.5 h-2 w-2 rounded-full bg-amber-400" />}
            </button>
          ))}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-slate-500">
          <Menu className="h-5 w-5" /> {t("Plus")}
        </button>
      </nav>

      <AnimatePresence>
        {newJob && (
          <JobForm
            job={null}
            clientId={newJob.clientId}
            onClose={() => setNewJob(null)}
            onSaved={(j, quoteId) => {
              setNewJob(null);
              go({ page: "chantier", id: j.id });
              if (quoteId) setDocId(quoteId);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{docId && <DocEditor key={docId} docId={docId} onClose={() => setDocId(null)} onOpen={setDocId} />}</AnimatePresence>
      <AnimatePresence>
        {voice && (
          <VoiceQuoteChat
            onClose={() => setVoice(false)}
            onOpenDoc={(id) => {
              // la conversation est conservée : elle reprend à la prochaine ouverture
              setVoice(false);
              setDocId(id);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {switching && <SwitchUser current={member} onPick={enter} onSuperAdmin={() => enter(null)} onClose={() => setSwitching(false)} />}
      </AnimatePresence>
      {m3d.notice && <Mode3DNotice reason={m3d.notice} onClose={m3d.clearNotice} />}
      <AnimatePresence>
        {denied && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} role="alert" className="fixed inset-x-4 bottom-20 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-rose-500/40 bg-ink p-4 text-sm shadow-2xl md:bottom-6">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p className="flex-1 text-slate-200">
              <strong className="text-rose-300">{t("Action refusée.")}</strong> {t("Vous n'avez pas le droit de modifier : {m}. Demandez au super admin.", { m: denied.map((d) => (d === "users" ? t("Utilisateurs et accès") : t(PERM_LABEL[d].label))).join(", ") })}
            </p>
            <button onClick={clearDenied} className="text-slate-500 hover:text-white" aria-label={t("Fermer")}>
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwitchUser({ current, onPick, onSuperAdmin, onClose }: { current: Member | null; onPick: (m: Member) => void; onSuperAdmin: () => void; onClose: () => void }) {
  const { t } = useTr();
  const { account, isDemo } = useAppData();
  const [mode, setMode] = useState<"menu" | "member" | "admin">("menu");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  if (mode === "member") return <WorkerLogin onEnter={onPick} onCancel={onClose} />;
  if (mode === "admin")
    return (
      <Modal title={t("Connexion du super admin")} onClose={onClose}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!account) return;
            setBusy(true);
            try {
              await logIn(account.email, pw);
              onSuperAdmin();
            } catch {
              setErr(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Mot de passe du compte {e}", { e: account?.email ?? "" })} error={err && t("Mot de passe incorrect.")}>
            <input autoFocus type="password" autoComplete="current-password" className={inputClass} value={pw} onChange={(e) => (setPw(e.target.value), setErr(false))} />
          </Field>
          <button disabled={!pw || busy} className="btn-primary w-full disabled:opacity-40">
            {t("Entrer")}
          </button>
        </form>
      </Modal>
    );
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-white">{t("Qui utilise cet appareil ?")}</p>
        <p className="text-xs text-slate-500">{t("Chaque utilisateur ne voit et ne modifie que les modules autorisés par le super admin.")}</p>
        {current && (
          <button onClick={() => (isDemo ? onSuperAdmin() : setMode("admin"))} className="btn-ghost w-full text-sm">
            {isDemo ? t("Super admin (démo : sans mot de passe)") : t("Super admin (mot de passe)")}
          </button>
        )}
        <button onClick={() => setMode("member")} className="btn-primary w-full text-sm">
          {t("Utilisateur de l'équipe (code PIN)")}
        </button>
      </div>
    </div>
  );
}

/** Fin de l'essai gratuit : abonnement requis pour continuer (les données restent exportables). */
function Paywall({ onBackup }: { onBackup: () => void }) {
  const { t } = useTr();
  return (
    <div className="card mx-auto max-w-xl space-y-5 p-8 text-center">
      <CreditCard className="mx-auto h-10 w-10 text-cyan" />
      <h1 className="font-display text-2xl font-bold text-white">{t("Votre essai gratuit de {n} jours est terminé", { n: TRIAL_DAYS })}</h1>
      <p className="text-sm text-slate-400">{t("Abonnez-vous pour continuer à utiliser Biltov. Vos chantiers, devis et factures sont conservés.")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={subscribeHref()!} className="btn-primary text-sm">
          {t("{p} € HTVA / mois", { p: PRICE_MONTHLY })}
        </a>
        <a href={subscribeHref(true)!} className="btn-ghost text-sm">
          {t("{p} € HTVA / an", { p: PRICE_YEARLY })}
        </a>
      </div>
      <p className="text-xs text-slate-500">{t("Paiement sécurisé par Stripe, prélèvement automatique, résiliable à tout moment.")}</p>
      <button onClick={onBackup} className="text-sm text-cyan hover:underline">
        {t("Télécharger une sauvegarde de mes données")}
      </button>
    </div>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  const { t } = useTr();
  return (
    <div className="card p-8 text-center">
      <p className="text-slate-300">{t("Élément introuvable ou supprimé.")}</p>
      <button onClick={onBack} className="btn-ghost mt-4 text-sm">
        {t("Retour")}
      </button>
    </div>
  );
}
