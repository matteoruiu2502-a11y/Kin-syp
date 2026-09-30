import Image from "next/image";
import { asset, cn } from "@/lib/utils";

/**
 * Logo officiel Biltov.
 * Le pictogramme est extrait du fichier fourni (public/brand/biltov-logo-original.webp) ;
 * son fond noir a été rendu transparent (biltov-mark-alpha.png). Le mot-symbole est rendu en texte
 * (Syne) pour rester lisible sur fond sombre — le mot-symbole d'origine est bleu nuit.
 */
export function BiltovLogo({ size = 36, className, wordmark = true }: { size?: number; className?: string; wordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-block" style={{ width: size, height: size * 1.125 }}>
        <span className="absolute inset-0 rounded-full bg-cyan/30 blur-xl" aria-hidden />
        <Image
          src={asset("/brand/biltov-mark-alpha.png")}
          alt={wordmark ? "" : "Biltov"}
          width={size}
          height={size * 1.125}
          priority
          className="relative"
        />
      </span>
      {wordmark && (
        <span className="font-display font-extrabold tracking-tight text-white" style={{ fontSize: size * 0.72 }}>
          Biltov
        </span>
      )}
    </span>
  );
}
