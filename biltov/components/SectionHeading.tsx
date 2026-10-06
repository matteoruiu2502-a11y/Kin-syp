import { Reveal } from "./Reveal";

export function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <Reveal className="mx-auto mb-14 max-w-3xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
        <span className="h-1.5 w-1.5 rounded-full bg-blue" />
        {eyebrow}
      </span>
      <h2 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">{title}</h2>
      {subtitle && <p className="mt-5 text-lg text-slate-400">{subtitle}</p>}
    </Reveal>
  );
}
