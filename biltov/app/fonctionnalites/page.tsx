import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { FeatureExplorer } from "@/components/site/FeatureExplorer";
import { VideoSection } from "@/components/site/VideoSection";
import { HelpButton } from "@/components/site/HelpButton";
import { FEATURES } from "@/lib/knowledge/features";
import { trialHref } from "@/lib/checkout";

export const metadata: Metadata = {
  title: "Fonctionnalités — Biltov",
  description: `Les ${FEATURES.length} fonctionnalités de Biltov expliquées pas à pas : dictée vocale, devis, factures, relances, chantiers, banque, équipe.`,
};

export default function FeaturesPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-x-clip pt-32 sm:pt-40">
        <div className="absolute left-1/2 top-20 -z-10 h-[500px] w-[900px] max-w-full -translate-x-1/2 rounded-full bg-blue/10 blur-[160px]" aria-hidden />
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal className="mx-auto mb-12 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald shadow-[0_0_10px_#10b981]" /> Guide
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">Tout ce que Biltov fait pour vous</h1>
            <p className="mt-5 text-lg text-slate-400">Chaque fonctionnalité expliquée simplement : à quoi elle sert, où la trouver et comment l&apos;utiliser, étape par étape.</p>
          </Reveal>
          <FeatureExplorer />
        </section>
        <VideoSection page="fonctionnalites" title="Voir Biltov en vidéo" />
        <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
          <Reveal className="glow-border card flex flex-col items-center gap-5 p-8 text-center sm:p-12">
            <h2 className="font-display text-3xl font-bold text-white">Prêt à essayer ?</h2>
            <p className="max-w-xl text-slate-400">5 jours gratuits, sans carte bancaire. Une question avant de commencer ? L&apos;assistant d&apos;aide vous répond.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={trialHref()} className="btn-primary">Essai gratuit 5 jours</a>
              <HelpButton />
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
