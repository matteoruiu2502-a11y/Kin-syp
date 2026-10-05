"use client";

import { ArrowUpRight, BadgeCheck, Lock, Server } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BiltovLogo } from "./BiltovLogo";

// Lucide ne fournit plus les logos de marques : pictos réseaux sociaux en SVG inline.
const SOCIALS = [
  { name: "LinkedIn", href: "https://www.linkedin.com/", path: "M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.02h4.56V23H.22V8.02zM8.34 8.02h4.37v2.05h.06c.61-1.15 2.1-2.37 4.32-2.37 4.62 0 5.47 3.04 5.47 7V23h-4.55v-7.29c0-1.74-.03-3.98-2.43-3.98-2.43 0-2.8 1.9-2.8 3.86V23H8.34V8.02z" },
  { name: "Instagram", href: "https://www.instagram.com/", path: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" },
  { name: "YouTube", href: "https://www.youtube.com/", path: "M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" },
  { name: "Facebook", href: "https://www.facebook.com/", path: "M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07z" },
];

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
// Liens valables depuis toutes les pages du site.
const PRODUCT_ANCHORS = [`${base}/fonctionnalites/`, `${base}/#metiers`, `${base}/#tarif`, `${base}/#roi`, `${base}/#demo`];
const COMPLIANCE_ICONS = [Lock, BadgeCheck, Server];

export function Footer() {
  const { t } = useI18n();
  const f = t.footer;

  return (
    <footer className="relative mt-10 border-t border-white/10 bg-night">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" aria-hidden />

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
                  aria-label={s.name}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-all hover:-translate-y-0.5 hover:border-cyan/50 hover:text-white hover:shadow-[0_0_20px_-4px_rgba(34,211,238,0.7)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title={f.product} items={f.links.product.map((label, i) => ({ label, href: PRODUCT_ANCHORS[i] ?? `${base}/` }))} />
          <FooterColumn title={f.company} items={f.links.company.map((label) => ({ label, href: "#" }))} />
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
