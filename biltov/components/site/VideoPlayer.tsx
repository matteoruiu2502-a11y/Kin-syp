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
    <div ref={box} className={cn("relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#03060d] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] theme-fixed", video.orientation === "portrait" ? "aspect-[9/16]" : "aspect-video", className)} style={style}>
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
          className="group absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/70 via-black/10 to-transparent"
          aria-label={`Lire la vidéo : ${video.title}`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue to-emerald text-white shadow-[0_0_40px_-6px_rgba(16,185,129,0.8)] transition-transform group-hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
          <span className="absolute inset-x-0 bottom-0 p-5 text-left">
            <span className="block font-display text-lg font-bold text-white">{video.title}</span>
            {video.duration && <span className="text-xs text-slate-300">{video.duration}</span>}
          </span>
        </button>
      )}
    </div>
  );
}
