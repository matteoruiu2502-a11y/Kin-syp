"use client";

import { ArrowUpRight, BadgeCheck, Lock, Server } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BiltovLogo } from "./BiltovLogo";
import { BILTOV_SOCIALS } from "@/lib/social";

// Lucide ne fournit plus les logos de marques : pictos réseaux sociaux en SVG inline.
const SOCIALS: { name: string; label?: string; href: string; path: string }[] = [
  { name: "LinkedIn", href: "https://www.linkedin.com/", path: "M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.02h4.56V23H.22V8.02zM8.34 8.02h4.37v2.05h.06c.61-1.15 2.1-2.37 4.32-2.37 4.62 0 5.47 3.04 5.47 7V23h-4.55v-7.29c0-1.74-.03-3.98-2.43-3.98-2.43 0-2.8 1.9-2.8 3.86V23H8.34V8.02z" },
  BILTOV_SOCIALS[0],
  { name: "YouTube", href: "https://www.youtube.com/", path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" },
  BILTOV_SOCIALS[1],
];

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
// Liens valables depuis toutes les pages du site.
const PRODUCT_ANCHORS = [`${base}/fonctionnalites/`, `${base}/#metiers`, `${base}/#tarif`, `${base}/#roi`, `${base}/#demo`];
const COMPANY_LINKS = [`${base}/a-propos/`];
const COMPLIANCE_ICONS = [Lock, BadgeCheck, Server];

export function Footer() {
  const { t } = useI18n();
  const f = t.footer;

  return (
    <footer className="relative mt-10 border-t border-white/10 bg-night">

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <BiltovLogo size={44} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{f.tagline}</p>


            <div className="mt-6 flex gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label ?? s.name}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-all hover:-translate-y-0.5 hover:border-cyan/50 hover:text-white hover:"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title={f.product} items={f.links.product.map((label, i) => ({ label, href: PRODUCT_ANCHORS[i] ?? `${base}/` }))} />
          <FooterColumn title={f.company} items={f.links.company.map((label, i) => ({ label, href: COMPANY_LINKS[i] ?? "#" }))} />
          <FooterColumn title={f.legal} items={f.links.legal.map((label) => ({ label, href: "#" }))} />
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          {f.compliance.map((c, i) => {
            const Icon = COMPLIANCE_ICONS[i % COMPLIANCE_ICONS.length];
            return (
              <span key={c} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300">
                <Icon className="h-3.5 w-3.5 text-emerald" /> {c}
              </span>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/5 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Biltov. {f.rights} <span className="text-slate-600">· v {process.env.NEXT_PUBLIC_BUILD} UTC</span>
          </p>
          <p>{f.made}</p>
        </div>
      </div>

      {/* Mot-symbole géant en filigrane */}
      <div className="pointer-events-none select-none overflow-hidden" aria-hidden>
        <p className="translate-y-[18%] text-center font-display text-[24vw] font-extrabold leading-none tracking-tighter text-transparent [-webkit-text-stroke:1px_rgba(148,163,184,0.12)]">Biltov</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <ul className="space-y-2.5">
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href} className="group inline-flex items-center gap-1 text-sm text-slate-300 transition-colors hover:text-white">
              {it.label}
              <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
