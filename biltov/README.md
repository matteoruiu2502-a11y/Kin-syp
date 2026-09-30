# Biltov

Logiciel des artisans du bâtiment **en Belgique** (FR / NL / DE) : page d'accueil + espace artisan.
Next.js 16 (App Router, export statique) · React 19 · Tailwind CSS 4 · Framer Motion · React Three Fiber · jsPDF · ExcelJS · Tesseract.

```bash
cd biltov
npm install
npm run dev      # http://localhost:3000
npm test         # tests (TVA belge, factures, Peppol, CODA, finances, traductions…)
npm run build    # export statique dans out/ (copie aussi les fichiers OCR dans public/ocr)
```

Pour publier dans un sous-dossier : `NEXT_PUBLIC_BASE_PATH=/mon/dossier npm run build`
(GitHub Pages le fait automatiquement : `/Kin-syp/biltov/`).

**Ce qui fonctionne, ce qui est partiel, ce qui attend le serveur : voir [FEATURES.md](FEATURES.md).**

## Structure

| Dossier / fichier | Rôle |
|---|---|
| `app/page.tsx`, `components/*.tsx`, `components/features/*`, `components/hero/*` | Page d'accueil (scène 3D, métiers, démo de dictée, tarif, FAQ) |
| `lib/content/{fr,nl,de}.ts` | Textes de la page d'accueil, par langue (même structure) |
| `app/tableau-de-bord/` + `components/app/*` | Espace artisan (navigation `#apercu`, `#chantiers`, `#clients`, `#documents`, `#catalogue`, `#planning`, `#equipe`, `#achats`, `#stock`, `#flotte`, `#modules`, `#parametres`) |
| `lib/tax/belgium/*` | Moteur fiscal belge : BCE / TVA (modulo 97), taux et règles de TVA, mentions, relances Livre XIX / loi 2002, **valeurs légales datées** (`config.ts`) |
| `lib/app/types.ts`, `defaults.ts`, `store.tsx`, `db.ts` | Modèle de données, stockage IndexedDB par collection (couche unique, remplaçable par un serveur) |
| `lib/app/ops.ts`, `money.ts` | Opérations métier pures (devis, versions, avenants, signature, acomptes, situations, émission, notes de crédit, paiements, rentabilité) |
| `lib/app/pdf.ts`, `epc.ts`, `peppol/*` | PDF des documents, QR de virement, UBL Peppol BIS 3.0 + interface `PeppolProvider` |
| `lib/app/catalog/*` | Catalogue : prix, rapprochement de la dictée, import Excel / CSV |
| `lib/app/finance.ts`, `coda.ts`, `reminders.ts`, `planning.ts`, `modules.ts`, `website.ts` | Argent à recevoir, trésorerie, aide TVA, obligation de retenue, journaux ; CODA ; relances ; planning ; modules complémentaires ; mini-site |
| `lib/app/tr.tsx`, `tr-dict.ts` | Traduction de l'espace artisan (textes FR dans le code, NL / DE dans le dictionnaire, couverture testée) |
| `public/manifest.webmanifest`, `public/sw.js` | Application installable et hors ligne |
| `lib/checkout.ts` | Boutons « Essai gratuit » → liens de paiement Stripe |

## Logo

Le logo fourni est dans `public/brand/biltov-logo-original.webp`. Le pictogramme en est extrait
(`public/brand/biltov-mark.png`) ; les icônes de l'application installable sont `public/brand/icon-192.png` et `icon-512.png`.

## Démonstration

`/tableau-de-bord/#demo` ouvre un espace déjà rempli (entreprise et clients belges fictifs) sans compte
ni numéro d'entreprise. Les PDF y portent la mention « DÉMONSTRATION ».

## Valeurs légales

Tous les taux, seuils et délais sont dans `lib/tax/belgium/config.ts`, avec leur date d'entrée en vigueur
et leur source. Ceux qui ne sont pas confirmés portent `verified: false` et apparaissent « à vérifier »
dans *Paramètres → Valeurs légales* : faites-les valider par un comptable avant la mise en service commerciale.

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
  entre appareils ; la sauvegarde JSON sert de copie de sécurité.
- Les envois partent depuis les applications de l'artisan (Mail, WhatsApp, SMS) ; la facture Peppol (UBL)
  se dépose chez le prestataire Peppol de l'artisan.
- Les rôles limitent l'affichage sur l'appareil, ce n'est pas un contrôle d'accès.
- L'abonnement n'est pas vérifié côté serveur : un site statique ne peut pas bloquer l'accès.
