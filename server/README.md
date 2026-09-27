# KinéSyP — service de comptes et d'abonnement

Petit serveur Node.js (aucun framework, SQLite intégré à Node) qui gère :

- **les comptes praticiens** : inscription / connexion par e-mail et mot de passe
  (scrypt salé), sessions signées (HMAC-SHA256, 30 jours), limitation des tentatives ;
- **l'offre** : 5 patients gratuits par compte, puis **abonnement 50 € / mois**
  (règles partagées : `mobile/src/core/billing.ts`) ;
- **le paiement Stripe** : Stripe Checkout (abonnement), portail client
  (carte, factures, résiliation), webhooks signés et idempotents.

**Aucune donnée de santé sur le serveur.** Il ne stocke que le compte, l'état
de l'abonnement et un identifiant opaque par patient (pour compter le quota).
Noms, mesures, photos et bilans restent sur la tablette / le navigateur.

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/auth/signup` | `{email, password, name}` → session |
| POST | `/auth/login` | `{email, password}` → session |
| GET | `/me` | compte, abonnement, droits (`entitlement`) |
| POST | `/patients` | `{clientId}` réserve une place ; **402** `quota_exceeded` au-delà de 5 sans abonnement |
| POST | `/billing/checkout` | URL Stripe Checkout (50 €/mois) |
| POST | `/billing/portal` | URL du portail client Stripe |
| POST | `/stripe/webhook` | événements Stripe (signature vérifiée) |

## Lancer

```bash
cd server
npm install
npm run dev          # http://localhost:8787, paiement simulé (sans Stripe)
npm test             # tests d'intégration (HTTP réel, webhooks Stripe signés)
```

Brancher les applications :
- web : `VITE_API_URL=http://localhost:8787 npm run dev` (dossier `web/`) ;
- tablette : `"extra": { "apiUrl": "https://api.kinesyp.fr" }` dans `mobile/app.json`.
Sans URL configurée, les applications passent en **mode démonstration**
(comptes sur l'appareil, paiement simulé, clairement signalé).

## Mise en production

1. Stripe : créer le produit « KinéSyP » et un prix récurrent **50 € / mois** ;
   activer le portail client ; créer l'endpoint webhook (voir `.env.example`).
2. Héberger ce serveur (Node ≥ 22.18) derrière HTTPS avec un disque persistant
   pour la base SQLite ; renseigner les variables de `.env.example`.
3. Sauvegarder régulièrement le fichier SQLite.

### Points à valider avant l'ouverture commerciale
- **Achats in-app (App Store / Google Play)** : Apple et Google imposent en
  principe leur propre système de paiement pour un abonnement vendu *dans*
  l'application. Options : vendre l'abonnement sur le site web uniquement
  (l'app se contente de se connecter), ou ajouter l'achat in-app. À trancher
  avant publication sur les stores.
- **Facturation / TVA** : activer Stripe Tax si nécessaire, mentions légales,
  CGV, politique de confidentialité (RGPD).
- Le quota compte les patients créés (une suppression ne libère pas de place).
