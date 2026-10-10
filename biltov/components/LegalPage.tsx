import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { LEGAL, LEGAL_LABELS, type LegalField } from "@/lib/legal";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Valeur de lib/legal.ts, ou emplacement « à compléter » bien visible. */
export function F({ k }: { k: LegalField }) {
  const v = LEGAL[k];
  if (v) return <>{v}</>;
  return <span className="rounded bg-amber-400/15 px-1 text-amber-300">[à compléter : {LEGAL_LABELS[k]}]</span>;
}

/** Lien vers une autre page du site (chemin de publication inclus). */
export function L({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={`${base}${href}`} className="text-cyan hover:underline">
      {children}
    </a>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-white sm:text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-300 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </section>
  );
}

export function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip pt-32 sm:pt-40">
        <article className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Dernière mise à jour : <F k="updated" />
          </p>
          {intro && <div className="mt-6 text-lg leading-relaxed text-slate-300">{intro}</div>}
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}
