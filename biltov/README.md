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
| `app/tableau-de-bord/` + `components/dashboard/*` | Tableau de bord : vue d'ensemble (indicateurs, statuts, derniers chantiers) et onglet **Chantiers & devis** (ajout, modification, duplication, suppression, changement de statut, recherche, filtres, tri par nom / client / ville / métier / montant / statut / date, export CSV) |
| `lib/jobs.ts` | Chantiers enregistrés dans le navigateur (`localStorage`), exemples de départ |
| `lib/checkout.ts` | Boutons « Essai gratuit » → liens de paiement Stripe |
| `lib/content/{fr,en,de}.ts` | Tous les textes, par langue (même structure) |
| `lib/parseQuote.ts` | Analyseur de dictée (FR / EN / DE) utilisé par la démo |

## Logo

Le logo fourni est dans `public/brand/biltov-logo-original.webp`. Le pictogramme en est extrait
(`public/brand/biltov-mark.png`, fond noir rendu transparent par `mix-blend-screen`) et le mot-symbole
est affiché en texte blanc, car celui d'origine (bleu nuit) serait illisible sur le fond sombre.
Pour utiliser un fichier SVG / PNG transparent officiel, remplacez l'image dans `components/BiltovLogo.tsx`.

## Paiement : essai d'1 jour, carte obligatoire, prélèvement automatique

Le site n'a pas de serveur : le paiement passe par des **liens de paiement Stripe** (Payment Links).
Stripe gère la carte, l'essai et les prélèvements.

1. **Stripe → Catalogue de produits** : créer le produit « Biltov Pro » avec deux prix récurrents,
   **80 € / mois** et **768 € / an**.
2. **Stripe → Liens de paiement → Nouveau** (un lien par prix) :
   - cocher **« Inclure une période d'essai gratuit »** et saisir **1 jour** ;
   - laisser la collecte du moyen de paiement sur **« toujours »** (carte exigée même pendant l'essai) :
     à la fin de l'essai, Stripe prélève automatiquement, puis chaque mois / an ;
   - onglet **Après le paiement** → « Ne pas afficher la page de confirmation » → rediriger vers
     `https://matteoruiu2502-a11y.github.io/Kin-syp/biltov/tableau-de-bord/?paiement=ok`.
3. **GitHub → Settings → Secrets and variables → Actions → Variables** : ajouter
   `BILTOV_STRIPE_LINK_MONTHLY` et `BILTOV_STRIPE_LINK_YEARLY` (les URL `https://buy.stripe.com/…`),
   puis relancer « Publier le site » (onglet Actions).
4. **Stripe → Portail client** : l'activer pour que vos clients puissent résilier eux-mêmes.

En local : `NEXT_PUBLIC_STRIPE_LINK_MONTHLY=https://buy.stripe.com/… npm run dev`.

**Limites de la version sans serveur**
- Les chantiers sont enregistrés dans le navigateur : ils ne se synchronisent pas entre appareils
  et disparaissent si l'utilisateur efface les données du site (l'export CSV sert de sauvegarde).
- L'accès au tableau de bord n'est pas verrouillé : un site statique ne peut pas vérifier un abonnement.
  Pour cela, il faut des comptes et un serveur (voir `server/`, déjà prévu pour Stripe côté KinéSyP).
