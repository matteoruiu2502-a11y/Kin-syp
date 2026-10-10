import { createBrowserClient } from "@supabase/ssr";

// Projet Supabase de Biltov par défaut : la clé publiable est faite pour être visible dans le navigateur
// (la protection repose sur les règles RLS). Ainsi, n'importe quel hébergement (GitHub Pages, Cloudflare Pages)
// construit le site sans réglage ; une variable d'environnement permet de pointer vers un autre projet.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vvqglabltzjvvvgtzyap.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_TdKSznmT50vmUlzwQ8FnDA_vtZvdIc0";

/** Supabase branché (variables présentes) : sinon, comptes et données restent sur l'appareil. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
