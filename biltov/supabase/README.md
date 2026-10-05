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
