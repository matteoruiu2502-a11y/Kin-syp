import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { trialHref } from "@/lib/checkout";
import { BILTOV_SOCIALS } from "@/lib/social";

export const metadata: Metadata = {
  title: "À propos — Biltov",
  description: "Biltov est une solution de devis et de facturation destinée aux artisans et entreprises du bâtiment en Belgique.",
};

// Texte fourni par le fondateur : à reproduire mot pour mot.
const TITLE = "À propos de Biltov";
const INTRO = "Biltov est une solution de devis et de facturation destinée aux artisans et entreprises du bâtiment en Belgique.";
const FOUNDER =
  "Fondateur et étudiant en gestion de chantier, Matteo a conçu Biltov à partir d'un constat simple : l'administratif absorbe un temps considérable que les professionnels du bâtiment devraient pouvoir consacrer à leurs chantiers. Associée à un intérêt de longue date pour le développement d'applications, cette connaissance du secteur a donné naissance à un outil pensé pour répondre aux besoins réels du terrain.";
const MARKET =
  "Biltov est développé exclusivement pour le marché belge, dans le respect de la TVA et de la réglementation en vigueur. Grâce à un assistant vocal, la création d'un devis ou d'une facture devient rapide et accessible, sans formalités superflues.";
const EVOLUTION =
  "Le produit évolue en continu, en étroite collaboration avec ses utilisateurs. Pour toute question ou suggestion, vous pouvez nous contacter directement : chaque retour contribue à améliorer la solution.";

// Photo du fondateur (optionnelle) : déposer l'image dans public/ et renseigner son chemin ici.
const FOUNDER_PHOTO = "/brand/matteo-fondateur.jpg";

export default function AboutPage() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip pt-32 sm:pt-40">
        <section className="mx-auto max-w-3xl px-4 sm:px-6">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-blue" /> Biltov
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">{TITLE}</h1>
            <p className="mt-8 text-lg leading-relaxed text-slate-300 sm:text-xl">{INTRO}</p>
          </Reveal>
        </section>

        <section className="mx-auto mt-16 max-w-3xl px-4 sm:mt-20 sm:px-6">
          <Reveal className="card p-6 sm:p-10">
            <div className="flex items-center gap-4">
              {FOUNDER_PHOTO ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${base}${FOUNDER_PHOTO}`} alt="Matteo, fondateur de Biltov" width={400} height={400} className="h-16 w-16 shrink-0 rounded-full border border-white/10 object-cover sm:h-20 sm:w-20" />
              ) : (
                <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue font-display text-2xl font-bold text-white">
                  M
                </span>
              )}
              <div>
                <p className="font-display text-lg font-semibold text-white">Matteo</p>
                <p className="text-sm text-slate-400">Fondateur de Biltov</p>
              </div>
            </div>
            <p className="mt-6 leading-relaxed text-slate-300">{FOUNDER}</p>
          </Reveal>
        </section>

        <section className="mx-auto mt-6 grid max-w-3xl gap-6 px-4 sm:px-6">
          <Reveal className="card p-6 sm:p-10">
            <p className="leading-relaxed text-slate-300">{MARKET}</p>
          </Reveal>
          <Reveal className="card p-6 sm:p-10">
            <p className="leading-relaxed text-slate-300">{EVOLUTION}</p>
            <div className="mt-6 flex gap-2">
              {BILTOV_SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-slate-400 transition-all hover:-translate-y-0.5 hover:border-cyan/50 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <Reveal>
            <a href={trialHref()} className="btn-primary">Essayer Biltov gratuitement pendant 5 jours</a>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
