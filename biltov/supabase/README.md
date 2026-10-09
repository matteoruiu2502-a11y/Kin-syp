# Fonction serveur Biltov (IA)

La clé de l'API Claude ne doit jamais se trouver dans le site (GitHub Pages est public). Elle vit dans
une **Supabase Edge Function** : `functions/biltov-ai/`.

| Route | Rôle |
|---|---|
| `POST …/functions/v1/biltov-ai/chat` | Chat d'aide (réponse en continu), répond uniquement à partir de `knowledge/biltov-features.md` |
| `POST …/functions/v1/biltov-ai/quote` | Dictée vocale : transforme un message en actions sur le devis |

## Mise en service (une fois)

1. Installer la CLI : `npm i -g supabase`, puis `supabase login` et `supabase link --project-ref <ref>`.
2. Secrets (jamais dans le code) :
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
   supabase secrets set ALLOWED_ORIGINS=https://matteoruiu2502-a11y.github.io
   supabase secrets set SUPPORT_EMAIL=support@votre-domaine.be   # facultatif
   ```
3. Déployer : `npm run knowledge && supabase functions deploy biltov-ai` (depuis le dossier `biltov/`).
4. Dans GitHub → Settings → Secrets and variables → Actions → Variables, ajouter
   `NEXT_PUBLIC_AI_ENDPOINT = https://<ref>.supabase.co/functions/v1/biltov-ai`, puis relancer la publication.

Tant que `NEXT_PUBLIC_AI_ENDPOINT` n'est pas défini, le site fonctionne en mode local : le chat répond à partir
de la base de connaissances (sans IA générative) et la dictée utilise l'analyse locale.

## Protection

- Origines autorisées (`ALLOWED_ORIGINS`), 30 messages de chat et 40 analyses de dictée par IP et par 10 minutes,
  20 messages d'historique et 2 000 caractères par message au maximum.
- Modèle : `claude-opus-5-5` (effort bas pour des réponses rapides), avec repli automatique en cas de refus.

# Comptes et données en ligne

Le site utilise Supabase pour les comptes artisans (Supabase Auth) et pour enregistrer leurs données
(clients, chantiers, devis, factures…) et leurs fichiers (photos, tickets, plans). Chaque appareil garde
une copie locale : l'espace fonctionne hors ligne et les modifications partent dès que la connexion revient.

| Élément | Rôle |
|---|---|
| `utils/supabase/client.ts` | Client navigateur (URL et clé publiable du projet) |
| `lib/app/auth.ts` | Inscription, connexion, déconnexion via Supabase Auth |
| `lib/app/cloud.ts` | Lecture des données en ligne et file d'envoi (conservée sur l'appareil en cas de coupure) |
| `migrations/20261009000000_account_data.sql` | Table `account_data`, bucket privé `biltov` et leurs règles RLS |

## Mise en service (une fois)

1. Tableau de bord Supabase → **SQL Editor** → coller le contenu de
   `migrations/20261009000000_account_data.sql` → **Run**.
2. **Authentication → URL Configuration** :
   - Site URL : `https://matteoruiu2502-a11y.github.io/Kin-syp/biltov/tableau-de-bord/`
   - Redirect URLs : ajouter la même adresse (lien de confirmation envoyé par e-mail).
3. Facultatif : **Authentication → Sign In / Providers → Email**, désactiver « Confirm email » pour que le
   compte soit utilisable tout de suite (sinon l'artisan doit d'abord cliquer le lien reçu par e-mail).

## Sécurité

La clé publiable est visible dans le site : c'est normal. La protection repose sur les règles RLS : chaque
compte ne lit et ne modifie que ses propres lignes de `account_data` et son propre dossier du bucket `biltov`.

## Comptes créés avant le passage en ligne

Ils étaient enregistrés uniquement sur l'appareil. L'artisan crée un compte en ligne avec **le même e-mail**
sur le même appareil : ses données locales (et leurs fichiers) sont reprises et envoyées en ligne
automatiquement.
