"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { LayoutDashboard, Menu, X } from "lucide-react";
import { BiltovLogo } from "./BiltovLogo";
import { useI18n } from "@/lib/i18n";
import { DASHBOARD_PATH, trialHref } from "@/lib/checkout";
import { LangSwitch } from "./LangSwitch";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#fonctionnalites", label: t.nav.features },
    { href: "#metiers", label: t.nav.trades },
    { href: "#tarif", label: t.nav.pricing },
    { href: "#roi", label: t.nav.roi },
  ];

  const langSwitch = <LangSwitch />;

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
      <nav
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between rounded-2xl border px-4 py-2.5 transition-all duration-500",
          scrolled ? "border-white/10 bg-ink/70 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl" : "border-transparent bg-transparent",
        )}
      >
        <a href="#top" aria-label="Biltov" className="shrink-0">
          <BiltovLogo size={34} />
        </a>

        <ul className="hidden items-center gap-1 xl:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="group relative rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white">
                {l.label}
                <span className="absolute inset-x-4 -bottom-0.5 h-px scale-x-0 bg-gradient-to-r from-blue to-emerald transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 xl:flex">
          {langSwitch}
          <Link href={DASHBOARD_PATH} className="btn-ghost whitespace-nowrap !px-4 !py-2.5 text-sm" aria-label={t.nav.dashboard} title={t.nav.dashboard}>
            <LayoutDashboard className="h-4 w-4" /> {t.nav.dashboard}
          </Link>
          <a href={trialHref()} className="btn-primary whitespace-nowrap !py-2.5 text-sm">
            {t.nav.cta}
          </a>
        </div>

        <button className="rounded-xl p-2 text-slate-200 xl:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? t.nav.closeMenu : t.nav.openMenu}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="card mx-auto mt-2 max-w-7xl p-4 xl:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-base font-medium text-slate-200 hover:bg-white/5">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              {langSwitch}
              <Link href={DASHBOARD_PATH} className="btn-ghost text-sm">
                <LayoutDashboard className="h-4 w-4" /> {t.nav.dashboard}
              </Link>
              <a href={trialHref()} onClick={() => setOpen(false)} className="btn-primary text-sm">
                {t.nav.cta}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
