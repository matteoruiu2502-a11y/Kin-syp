# Serveur Biltov (Cloudflare Workers)

Petit serveur gratuit qui rend les forfaits **impossibles à contourner** pour tout ce qui coûte de l'argent :

- **abonnements Stripe** : souscription, changement de forfait au prorata, paiement échoué avec délai de grâce, annulation ;
- **licence signée** : l'application reçoit l'état de l'abonnement signé (ECDSA). Elle ne peut pas s'attribuer un forfait ;
- **envoi Peppol** : seul le serveur envoie. Il compte les factures, bloque au quota (Starter, Pro, essai) et facture le dépassement du Max (tâche de nuit).

Les prix, quotas et modules viennent de `../lib/plans.ts` (même fichier que le site).

## Mise en place (environ 30 minutes)

1. **Compte Cloudflare gratuit** sur https://dash.cloudflare.com, puis dans ce dossier :
   ```sh
   npx wrangler login
   npx wrangler d1 create biltov            # copiez l'identifiant affiché dans wrangler.toml (database_id)
   npx wrangler d1 execute biltov --remote --file=schema.sql
   ```
2. **Clés de signature des licences** :
   ```sh
   node scripts/generate-keys.mjs
   npx wrangler secret put LICENSE_PRIVATE_KEY      # collez la clé privée
   ```
   La clé **publique** va dans GitHub : *Settings → Secrets and variables → Actions → Variables* → `BILTOV_BILLING_PUBLIC_KEY`.
3. **Stripe** (https://dashboard.stripe.com) :
   - *Catalogue de produits* : 3 produits (Starter, Pro, Max), chacun avec un prix **mensuel** et un prix **annuel**
     (montants HTVA de `lib/plans.ts` ; annuel = 10 mois). Copiez les 6 identifiants `price_…` dans `STRIPE_PRICES` (wrangler.toml).
   - *Taxes → Taux de taxe* : « TVA Belgique 21 % », **exclusif** (ajouté au prix). Copiez `txr_…` dans `STRIPE_TAX_RATE`.
   - *Paramètres → Facturation → Abonnements* : activez les relances automatiques (Smart Retries) et choisissez
     « laisser l'abonnement en retard » (past_due) en cas d'échec. Le délai de grâce Biltov (`GRACE_DAYS`) s'applique ensuite.
   - *Portail client* : activez-le (moyen de paiement, factures).
   - *Moyens de paiement* : cartes, Bancontact, domiciliation SEPA.
   - Clés : `npx wrangler secret put STRIPE_SECRET_KEY` (clé secrète `sk_live_…`).
   - *Développeurs → Webhooks* : point de terminaison `https://<votre-worker>.workers.dev/stripe/webhook`, événements
     `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.
     Puis `npx wrangler secret put STRIPE_WEBHOOK_SECRET` (`whsec_…`).
4. **Déployer** : `npx wrangler deploy`. Copiez l'adresse `https://biltov-billing.<compte>.workers.dev` dans la variable GitHub
   `BILTOV_BILLING_API_URL`, puis relancez la publication du site.
5. **Peppol** : tant que `PEPPOL_PROVIDER = "simulation"`, rien n'est réellement envoyé (le parcours et le compteur sont testables).
   Pour la production, ouvrez un compte chez un Access Point **payé à la facture**, adaptez `httpAccessPoint` dans `src/peppol.ts`
   à son API, puis : `PEPPOL_PROVIDER = "http"`, `PEPPOL_API_URL` (wrangler.toml) et `npx wrangler secret put PEPPOL_API_KEY`.
   Chaque entreprise cliente doit être enregistrée comme émetteur chez ce prestataire (numéro BCE, schéma 0208).

## Routes

| Route | Rôle |
|---|---|
| `POST /v1/register` | première connexion d'une entreprise : démarre l'essai (un seul par numéro BCE) |
| `POST /v1/license` | licence signée à jour |
| `POST /v1/checkout` | page de paiement Stripe d'un forfait (mensuel ou annuel) |
| `POST /v1/subscription/change` | changement de forfait au prorata |
| `POST /v1/subscription/cancel` | annulation en fin de période (ou reprise) |
| `POST /v1/portal` | portail Stripe (moyen de paiement, factures) |
| `POST /v1/invoices` | historique de facturation |
| `POST /v1/peppol/send` | envoi d'une facture via Peppol, avec contrôle du quota |
| `POST /stripe/webhook` | notifications Stripe (signature vérifiée) |

Tests : `npx vitest run server` depuis le dossier `biltov`.
