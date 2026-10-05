import { videosFor } from "@/lib/videos";
import { SectionHeading } from "../SectionHeading";
import { Reveal } from "../Reveal";
import { VideoPlayer } from "./VideoPlayer";

/** Les vidéos rattachées à une page (déclarées dans content/videos.json). */
export function VideoSection({ page, eyebrow = "En vidéo", title, subtitle }: { page: string; eyebrow?: string; title: string; subtitle?: string }) {
  const videos = videosFor(page);
  if (!videos.length) return null;
  return (
    <section id="videos" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={eyebrow} title={title} subtitle={subtitle} />
        <div className={videos.length === 1 ? "mx-auto max-w-sm" : "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"}>
          {videos.map((v, i) => (
            <Reveal key={v.id} delay={i * 0.08} className="mx-auto w-full max-w-sm">
              <VideoPlayer video={v} className="glow-ring" style={{ "--glow-delay": `${-i * 1.3}s` } as React.CSSProperties} />
              <h3 className="mt-4 font-display text-lg font-bold text-white">{v.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{v.description}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
