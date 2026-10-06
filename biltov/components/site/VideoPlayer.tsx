"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard, Play } from "lucide-react";
import { videoUrl, type Video } from "@/lib/videos";
import { cn } from "@/lib/utils";

/**
 * Lecteur vidéo réutilisable : image d'aperçu tant que la vidéo est loin de l'écran (chargement différé),
 * puis <video> avec contrôles, lecture dans la page sur mobile (playsInline), préchargement des seules
 * métadonnées et aucune lecture automatique. Le cadre a ses proportions fixes : pas de décalage de mise en page.
 */
export function VideoPlayer({ video, className, style }: { video: Video; className?: string; style?: React.CSSProperties }) {
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [wantPlay, setWantPlay] = useState(false);
  const src = videoUrl(video.file);
  const poster = video.poster ? videoUrl(video.poster) : undefined;

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // Lecture uniquement après un geste de l'utilisateur.
  useEffect(() => {
    if (wantPlay && ref.current) void ref.current.play().catch(() => {});
  }, [wantPlay, near]);

  return (
    <div ref={box} className={cn("relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1220] shadow-[var(--shadow)] theme-fixed", video.orientation === "portrait" ? "aspect-[9/16]" : "aspect-video", className)} style={style}>
      {!src ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
          <Clapperboard className="h-8 w-8 text-cyan" />
          <p className="text-sm font-semibold text-white">Vidéo à venir</p>
          <p className="text-xs">{video.title}</p>
        </div>
      ) : near ? (
        <video ref={ref} className="h-full w-full object-cover" src={src} poster={poster} controls playsInline preload="metadata" aria-label={video.title}>
          <track kind="captions" />
        </video>
      ) : (
        <img src={poster} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      )}
      {src && !wantPlay && (
        <button
          type="button"
          onClick={() => (setNear(true), setWantPlay(true))}
          className="group absolute inset-0 flex items-end"
          aria-label={`Lire la vidéo : ${video.title}`}
        >
          {/* Bouton lecture discret en bas à gauche (le titre est déjà sous la carte) : il ne cache pas l'aperçu */}
          <span className="m-3 flex items-center gap-2 rounded-full bg-black/60 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-white backdrop-blur-sm sm:m-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue transition-colors group-hover:bg-[var(--brand-hover)]">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
            {video.duration ?? "Lire"}
          </span>
        </button>
      )}
    </div>
  );
}
