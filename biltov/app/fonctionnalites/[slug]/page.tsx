import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Info, Lightbulb, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { IPhoneFrame } from "@/components/site/IPhoneFrame";
import { FeatureIcon } from "@/components/site/FeatureIcon";
import { VideoSection } from "@/components/site/VideoSection";
import { HelpButton } from "@/components/site/HelpButton";
import { CATEGORIES, FEATURES } from "@/lib/knowledge/features";
import { trialHref } from "@/lib/checkout";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const f = FEATURES.find((x) => x.slug === slug);
  return f ? { title: `${f.title} — Biltov`, description: `${f.tagline} ${f.what}`.slice(0, 160) } : {};
}

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default async function FeaturePage({ params }: Params) {
  const { slug } = await params;
  const f = FEATURES.find((x) => x.slug === slug);
  if (!f) notFound();
  const category = CATEGORIES.find((c) => c.id === f.category)!;
  // Capture prise dans la démo par scripts/screenshots.mjs (vérifiée au moment du build).
  const shot = existsSync(join(process.cwd(), "public/screenshots", `${f.slug}.jpg`)) ? `${base}/screenshots/${f.slug}.jpg` : null;
  const related = FEATURES.filter((x) => x.category === f.category && x.slug !== f.slug).slice(0, 3);

  return (
    <>
      <Navbar />
      <main className="overflow-x-clip pt-28 sm:pt-36">
        <div className="absolute left-1/2 top-16 -z-10 h-[460px] w-[820px] max-w-full -translate-x-1/2 rounded-full bg-blue/10 blur-[150px]" aria-hidden />
        <article className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_340px] lg:gap-16">
          <div className="min-w-0">
            <Link href="/fonctionnalites/" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Toutes les fonctionnalités
            </Link>
            <Reveal className="mt-4">
              <span className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue/25 to-emerald/25 text-cyan ring-1 ring-white/10">
                  <FeatureIcon name={f.icon} className="h-6 w-6" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{category.label}</span>
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">{f.title}</h1>
              <p className="mt-4 text-xl text-slate-300">{f.tagline}</p>
              <p className="mt-6 text-base leading-relaxed text-slate-400 sm:text-lg">{f.what}</p>
            </Reveal>

            <Reveal className="card mt-8 flex gap-4 p-5" delay={0.05}>
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald" />
              <p className="text-sm leading-relaxed text-slate-300">
                <strong className="text-white">Où la trouver : </strong>
                {f.where}
              </p>
            </Reveal>

            <Reveal className="mt-10" delay={0.05}>
              <h2 className="font-display text-2xl font-bold text-white">Étape par étape</h2>
              <ol className="mt-5 space-y-3">
                {f.steps.map((s, i) => (
                  <li key={i} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald font-display text-sm font-bold text-white theme-fixed">{i + 1}</span>
                    <span className="pt-1 text-sm leading-relaxed text-slate-200 sm:text-base">{s}</span>
                  </li>
                ))}
              </ol>
            </Reveal>

            {f.tips.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-white">
                  <Lightbulb className="h-5 w-5 text-amber-300" /> Astuces
                </h2>
                <ul className="mt-4 space-y-2">
                  {f.tips.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" /> {s}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {f.notes.length > 0 && (
              <Reveal className="mt-10 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5">
                <h2 className="flex items-center gap-2 font-semibold text-white">
                  <Info className="h-4 w-4 text-sky-300" /> Bon à savoir
                </h2>
                <ul className="mt-3 space-y-2">
                  {f.notes.map((s, i) => (
                    <li key={i} className="text-sm leading-relaxed text-slate-300">{s}</li>
                  ))}
                </ul>
              </Reveal>
            )}

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href={trialHref()} className="btn-primary">Essayer gratuitement</a>
              <HelpButton question={`J'ai une question sur « ${f.title} » : `}>Une question sur cette fonctionnalité ?</HelpButton>
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Reveal delay={0.1}>
              <IPhoneFrame label={f.shot?.caption ?? f.title}>
                {shot ? (
                  <img src={shot} alt={`Capture d'écran : ${f.title}`} width={390} height={844} loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <FeatureIcon name={f.icon} className="h-12 w-12 text-cyan" />
                    <p className="font-display text-lg font-bold text-white">{f.title}</p>
                    <p className="text-xs text-slate-400">{f.where}</p>
                  </div>
                )}
              </IPhoneFrame>
            </Reveal>
          </aside>
        </article>

        <VideoSection page={`fonctionnalites/${f.slug}`} title="En vidéo" />

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <h2 className="mb-6 font-display text-2xl font-bold text-white">Dans la même catégorie</h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/fonctionnalites/${r.slug}/`} className="card group flex h-full items-start gap-4 p-5 hover:border-cyan/40">
                    <FeatureIcon name={r.icon} className="mt-0.5 h-5 w-5 shrink-0 text-cyan" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{r.title}</span>
                      <span className="mt-1 block text-sm text-slate-400">{r.tagline}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-cyan" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
