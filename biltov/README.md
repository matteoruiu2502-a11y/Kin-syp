# Biltov — landing page

Landing page de **Biltov**, l'assistant IA vocal et de facturation pour les artisans du BTP.
Next.js (App Router, export statique) · Tailwind CSS 4 · Framer Motion · Three.js / React Three Fiber · Lucide.

```bash
cd biltov
npm install
npm run dev      # http://localhost:3000
npm run build    # export statique dans out/ (copie aussi les fichiers OCR dans public/ocr)
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
| `app/tableau-de-bord/` + `components/app/*` | **Espace artisan** (voir ci-dessous) |
| `lib/app/*` | Comptes, stockage IndexedDB, calculs, mentions légales, PDF, relances, dictée, OCR |
| `lib/checkout.ts` | Boutons « Essai gratuit » → liens de paiement Stripe |
| `lib/content/{fr,en,de}.ts` | Tous les textes, par langue (même structure) |
| `lib/parseQuote.ts` | Analyseur de dictée (FR / EN / DE) utilisé par la démo |

## Logo

Le logo fourni est dans `public/brand/biltov-logo-original.webp`. Le pictogramme en est extrait
(`public/brand/biltov-mark.png`, fond noir rendu transparent par `mix-blend-screen`) et le mot-symbole
est affiché en texte blanc, car celui d'origine (bleu nuit) serait illisible sur le fond sombre.
Pour utiliser un fichier SVG / PNG transparent officiel, remplacez l'image dans `components/BiltovLogo.tsx`.

## Espace artisan (`/tableau-de-bord/`)

1. **Compte obligatoire** : création (e-mail + mot de passe, dérivé par PBKDF2) ou connexion.
2. **Entreprise** (obligatoire avant tout devis) : raison sociale, forme juridique, capital, siège,
   SIRET (clé de Luhn vérifiée), RCS / RM, TVA intracommunautaire (calculée et vérifiée), régime de TVA
   (franchise art. 293 B), assurance décennale (assureur, contrat, couverture — loi Pinel),
   médiateur de la consommation, IBAN (vérifié), logo et couleur des PDF.
3. **Chantiers & devis** : liste avec recherche, filtres, tri par colonne, export CSV. Un nouveau chantier
   peut être **dicté** (« Pour Mme Martin, 24 m² de parquet à 45 euros… ») : client et lignes du devis sont
   remplis automatiquement. Fiche chantier : client particulier / pro (SIREN), adresse du chantier,
   début et durée, contrat hors établissement, logement de plus de 2 ans (TVA 10 % / 5,5 %), autoliquidation.
4. **Devis** : lignes dictées, au clavier ou depuis le catalogue du métier, TVA par ligne, acompte,
   validité ; **signature du client à l'écran** (« Bon pour accord, devis reçu avant l'exécution des travaux »
   + attestation de TVA réduite) ; PDF conforme.
5. **Factures** : d'acompte, de solde (déduit les acomptes) ou complète, depuis le devis signé.
   À l'émission : numéro chronologique continu (F-2026-0001…) et verrouillage — toute correction passe
   par un **avoir**. Mentions : échéance, pénalités de retard, indemnité de 40 € (pros), escompte,
   catégorie de l'opération, SIREN du client, option TVA sur les débits, IBAN. Journal des ventes CSV.
6. **Envoi** : partage natif avec le PDF joint (mobile), ou e-mail / WhatsApp / SMS pré-remplis
   avec téléchargement du PDF ; historique des envois.
7. **Relances** à J+7, J+14 et J+21 après l'échéance (rappel, relance ferme, mise en demeure) :
   listées chaque jour sur l'aperçu, envoyées en un clic, arrêtées au paiement.
8. **Photos** avant / pendant / après, horodatées, comparaison glissante et **rapport photo PDF**.
9. **Dépenses** : photo du ticket lue par OCR (Tesseract, dans le navigateur, sans CDN) et **marge du chantier**.
10. **Sauvegarde / restauration** complète (JSON, photos comprises).

Mentions légales : elles suivent le Code de commerce (L441-9, L441-10, D441-5), le CGI (242 nonies A, 293 B,
279-0 bis, 283-2 nonies), le Code de la consommation (L221-18, L612-1) et le Code des assurances (L243-2).
Faites-les valider par votre expert-comptable avant la mise en service commerciale.

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
- Comptes et données sont enregistrés dans le navigateur de l'appareil (IndexedDB) : pas de synchronisation
  entre appareils ; la sauvegarde JSON sert de copie de sécurité (factures à conserver 10 ans).
- Les envois partent depuis les applications de l'artisan (Mail, WhatsApp, SMS) : pas d'envoi automatique
  en arrière-plan ; les relances sont préparées chaque jour et envoyées en un clic.
- L'abonnement n'est pas vérifié côté serveur : un site statique ne peut pas bloquer l'accès.
- La TVA gérée dans l'espace artisan est la TVA française (20 / 10 / 5,5 %, franchise, autoliquidation).
