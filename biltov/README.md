# Biltov — landing page

Landing page de **Biltov**, l'assistant IA vocal et de facturation pour les artisans du BTP.
Next.js (App Router, export statique) · Tailwind CSS 4 · Framer Motion · Three.js / React Three Fiber · Lucide.

```bash
cd biltov
npm install
npm run dev      # http://localhost:3000
npm run build    # export statique dans out/
```

Pour publier dans un sous-dossier : `NEXT_PUBLIC_BASE_PATH=/mon/dossier npm run build`
(GitHub Pages le fait automatiquement : `/Kin-syp/biltov/`).

## Structure

| Fichier | Rôle |
|---|---|
| `app/layout.tsx`, `app/page.tsx` | Polices (Syne + Plus Jakarta Sans), métadonnées, ordre des sections |
| `components/Navbar.tsx` | Logo, ancres, sélecteur FR / EN / DE, CTA « Essai Gratuit 14 Jours », menu mobile |
| `components/Hero.tsx` + `hero/HeroScene.tsx` | H1, CTA, réassurance ; scène 3D : immeuble qui se construit (fil de fer → solide), anneau de scan, grue, particules, parallaxe souris |
| `components/TradeOnboarding.tsx` | Filtre métier (plombier, électricien, peintre, maçon, menuisier) : jargon, fournitures, devis type, TVA |
| `components/features/*` | Bento grid : dictée → PDF, envoi multi-canal, relances J+7/14/21, photos avant/après + scan de ticket, branding & TVA multi-pays |
| `components/LiveQuoteDemo.tsx` | Simulateur de devis en direct (phrases exemples, texte libre, ou vrai micro via Web Speech API) |
| `components/RoiCalculator.tsx`, `Pricing.tsx`, `Faq.tsx`, `Footer.tsx` | Calculateur ROI, tarif unique 80 €/mois (64 € en annuel), FAQ, pied de page |
| `lib/content/{fr,en,de}.ts` | Tous les textes, par langue (même structure) |
| `lib/parseQuote.ts` | Analyseur de dictée (FR / EN / DE) utilisé par la démo |

## Logo

Le logo fourni est dans `public/brand/biltov-logo-original.webp`. Le pictogramme en est extrait
(`public/brand/biltov-mark.png`, fond noir rendu transparent par `mix-blend-screen`) et le mot-symbole
est affiché en texte blanc, car celui d'origine (bleu nuit) serait illisible sur le fond sombre.
Pour utiliser un fichier SVG / PNG transparent officiel, remplacez l'image dans `components/BiltovLogo.tsx`.
