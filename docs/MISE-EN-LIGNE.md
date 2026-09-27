# Mise en ligne de KinéSyP — ce qu'il reste à faire

Tout le code, les automatisations et les textes sont prêts. Les étapes
ci-dessous demandent **vos comptes et vos paiements** : elles ne peuvent pas
être faites à votre place. Comptez environ une heure pour les étapes 1 à 3.

## 1. Version web en ligne, avec caméra — déjà faite

La version web est publiée par GitHub Pages dans le dossier `app/`, à côté
du site Escal'hop! (qui reste à l'adresse racine) :

- Application : **https://matteoruiu2502-a11y.github.io/Kin-syp/app/**
  (ouvrez-la sur la tablette : la caméra fonctionne)
- Pages légales : `…/Kin-syp/app/legal/confidentialite.html`, `cgu.html`,
  `mentions-legales.html`

Publication automatique à chaque modification de la branche principale
(workflow « Publier le site », qui publie aussi Escal'hop! à la racine).
Réglage requis une seule fois : **Settings → Pages → Source : GitHub Actions**.

## 2. Application tablette installable (15 min, gratuit sur Android)

1. Créez un compte sur **expo.dev**, puis **Account settings → Access tokens →
   Create token**. Copiez le jeton.
2. Sur GitHub : **Settings → Secrets and variables → Actions → New repository
   secret**, nom `EXPO_TOKEN`, valeur = le jeton.
3. **Actions → « Construire l'app tablette » → Run workflow** (plateforme
   `android`, profil `preview`).
4. À la fin (15-20 min), la page du job affiche un lien : ouvrez-le depuis la
   tablette Android et installez l'application.

iPad : il faut d'abord un compte **Apple Developer** (99 €/an). Le premier
build iOS se lance une fois depuis un ordinateur pour enregistrer les
certificats : `cd mobile && npx eas-cli login && npx eas-cli build -p ios --profile preview`
(l'outil guide pas à pas). Les suivants peuvent passer par GitHub Actions.

## 3. Comptes et paiement réels (30 min)

1. **Stripe** (stripe.com), en **mode test** d'abord : créez le produit
   « KinéSyP », prix récurrent **50 €/mois** ; notez l'ID du prix (`price_…`)
   et la clé secrète (`sk_test_…`).
2. **Render** (render.com) → **New → Blueprint** → choisissez ce dépôt : le
   fichier `render.yaml` configure le serveur (offre avec disque ≈ 7 $/mois).
   Renseignez `APP_URL` et `CORS_ORIGINS` = l'adresse de l'étape 1, et les
   clés Stripe.
3. Dans Stripe → **Webhooks** : endpoint `https://<votre-serveur>/stripe/webhook`,
   événements `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted` ; copiez
   le secret `whsec_…` dans Render (`STRIPE_WEBHOOK_SECRET`).
4. Sur GitHub : **Settings → Secrets and variables → Actions → Variables →**
   `KINESYP_API_URL` = `https://<votre-serveur>`. Relancez les deux workflows :
   la version web et l'app tablette utilisent maintenant les vrais comptes.
5. Testez un abonnement avec la carte **4242 4242 4242 4242**, puis passez
   Stripe en mode réel (`sk_live_…`).

## 4. Tester avant de publier

- [ ] Mesures comparées à un goniomètre sur plusieurs personnes (genou, coude, épaule)
- [ ] Lumière faible, contre-jour, vêtements amples
- [ ] Alertes de compensation et de caméra mal placée
- [ ] Modes Sport, Pédiatrie, Posturo ; fantôme à une deuxième séance
- [ ] Dictée, bilan PDF partagé par e-mail
- [ ] Création de compte, 6e patient bloqué, abonnement, résiliation

## 5. Publier sur les stores

1. Complétez les passages `[entre crochets]` des pages légales
   (`web/public/legal/`) et faites-les relire par un juriste.
2. Décidez comment vendre l'abonnement (voir `docs/fiche-stores.md`, point bloquant).
3. Faites valider le statut réglementaire (dispositif médical ou non).
4. Comptes : **Google Play Console** (25 $, une fois) et **App Store Connect**.
5. Sur expo.dev → projet → **Credentials** : ajoutez la clé de compte de service
   Google Play et la clé API App Store Connect (l'outil explique où les créer).
   Créez aussi la fiche de l'app dans les deux consoles (identifiant
   `com.kinesyp.app`).
6. **Actions → « Construire l'app tablette »** : profil `production`,
   plateforme `all`, case « Envoyer aussi aux stores » cochée.
7. Dans les consoles des stores : collez les textes de `docs/fiche-stores.md`,
   ajoutez les captures, remplissez les formulaires de confidentialité, puis
   soumettez (Google : test interne puis production ; Apple : TestFlight puis
   vérification).
