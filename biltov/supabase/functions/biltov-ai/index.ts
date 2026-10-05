// Fonction serveur Biltov (Supabase Edge Function, Deno) : la clé de l'API Claude reste ici, jamais
// dans le navigateur. Deux routes :
//   POST /biltov-ai/chat   → chat d'aide, réponse en continu (texte brut)
//   POST /biltov-ai/quote  → dictée vocale : interprète un message et renvoie des actions sur le devis (JSON)
// Secrets : ANTHROPIC_API_KEY (obligatoire), ALLOWED_ORIGINS (ex. « https://matteoruiu2502-a11y.github.io »),
// SUPPORT_EMAIL (facultatif).

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { KNOWLEDGE } from "./knowledge.ts";

const MODEL = "claude-opus-5-5";
const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const SUPPORT = Deno.env.get("SUPPORT_EMAIL") ?? "";

// ── Limites anti-abus ───────────────────────────────────────────────────────
const WINDOW_MS = 10 * 60 * 1000;
const LIMITS = { chat: 30, quote: 40 }; // requêtes par adresse IP et par fenêtre de 10 minutes
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;
const hits = new Map<string, number[]>();

function limited(key: string, max: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= max) return true;
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return false;
}

function cors(origin: string | null) {
  const allowed = origin && (ORIGINS.length === 0 || ORIGINS.includes(origin)) ? origin : (ORIGINS[0] ?? "*");
  return { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", Vary: "Origin" };
}

const json = (body: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

// ── Chat d'aide ─────────────────────────────────────────────────────────────
const HELP_SYSTEM = `Tu es l'assistant d'aide de Biltov, un logiciel de devis et de facturation à la voix pour les artisans du bâtiment en Belgique.
Tu réponds aux questions sur l'utilisation du site, comme un membre bienveillant de l'équipe support.

Règles :
- Réponds UNIQUEMENT à partir de la base de connaissances ci-dessous. N'invente jamais un bouton, un menu, un prix ou une fonction.
- Si la réponse n'y figure pas, dis-le simplement et propose de contacter le support${SUPPORT ? ` (${SUPPORT})` : ""}.
- Réponds en français, de façon claire, courte et pédagogique : 2 à 6 phrases ou une courte liste d'étapes numérotées.
- Indique où cliquer en reprenant les noms exacts des menus et boutons entre guillemets « ».
- Quand c'est utile, termine par un lien vers la page de la fonctionnalité, au format [titre](/fonctionnalites/slug/).
- Les questions sans rapport avec Biltov : explique poliment que tu aides uniquement à utiliser Biltov.

<base_de_connaissances>
${KNOWLEDGE}
</base_de_connaissances>`;

const ChatBody = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_CHARS) })).min(1).max(MAX_MESSAGES) });

async function chat(body: unknown, headers: Record<string, string>) {
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success || parsed.data.messages[0].role !== "user") return json({ error: "invalid_request" }, 400, headers);

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [{ type: "text", text: HELP_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: parsed.data.messages,
  });

  const encoder = new TextEncoder();
  const body$ = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n\nJe ne peux pas répondre à cette demande. Pour toute question sur Biltov, je reste à votre disposition."));
      } catch (e) {
        console.error("chat", e);
        controller.enqueue(encoder.encode("\n\n[[erreur]]"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body$, { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

// ── Dictée vocale : interprétation d'un message ─────────────────────────────
const Line = z.object({ id: z.string(), label: z.string(), qty: z.number(), unit: z.string(), unitPrice: z.number() });
const QuoteBody = z.object({
  text: z.string().min(1).max(MAX_CHARS),
  draft: z.object({ client: z.string().nullable(), lines: z.array(Line).max(200) }),
  catalog: z.array(z.object({ label: z.string(), unit: z.string(), price: z.number() })).max(400),
  pending: z.string().nullable(), // question posée juste avant par l'assistant
});

const QuoteResult = z.object({
  client: z.string().nullable(),
  actions: z.array(
    z.object({
      op: z.enum(["add", "update", "remove"]),
      lineId: z.string().nullable(),
      label: z.string().nullable(),
      qty: z.number().nullable(),
      unit: z.string().nullable(),
      unitPrice: z.number().nullable(),
    }),
  ),
  reply: z.string(),
});

const QUOTE_SYSTEM = `Tu aides un artisan du bâtiment belge à rédiger un devis à partir de messages dictés (souvent mal transcrits).
À partir du message, du devis en cours et du catalogue de l'artisan, renvoie :
- client : le nom du client s'il est donné ou déjà connu, sinon null ;
- actions : les modifications du devis. « add » pour une nouvelle ligne (label clair, qty, unit parmi u, m², m³, ml, h, j, forfait, kg ; unitPrice du message, sinon le prix du catalogue pour un article équivalent, sinon null) ; « update » pour modifier une ligne existante (lineId obligatoire, seuls les champs à changer, les autres à null) ; « remove » pour supprimer (lineId).
- reply : une phrase courte en français pour l'artisan (ce que tu as compris ou fait). Ne pose pas de question : l'application demande elle-même les informations manquantes.
N'invente jamais un prix : sans prix dicté ni article du catalogue, unitPrice = null. Si le message répond à la question en attente, applique la réponse à la ligne concernée.`;

async function quote(body: unknown, headers: Record<string, string>) {
  const parsed = QuoteBody.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_request" }, 400, headers);
  const { text, draft, catalog, pending } = parsed.data;
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(QuoteResult) },
    system: QUOTE_SYSTEM,
    messages: [{ role: "user", content: `Catalogue (extrait) : ${JSON.stringify(catalog)}\n\nDevis en cours : ${JSON.stringify(draft)}\n\nQuestion en attente : ${pending ?? "aucune"}\n\nMessage de l'artisan : « ${text} »` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return json({ error: "unparsed" }, 422, headers);
  return json(response.parsed_output, 200, headers);
}

// ── Point d'entrée ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);
  if (ORIGINS.length && (!origin || !ORIGINS.includes(origin))) return json({ error: "forbidden_origin" }, 403, headers);

  const route = new URL(req.url).pathname.split("/").pop();
  if (route !== "chat" && route !== "quote") return json({ error: "not_found" }, 404, headers);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (limited(`${route}:${ip}`, LIMITS[route])) return json({ error: "rate_limited" }, 429, { ...headers, "Retry-After": "600" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }
  try {
    return route === "chat" ? await chat(body, headers) : await quote(body, headers);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 503, headers);
    if (e instanceof Anthropic.APIError) {
      console.error("anthropic", e.status, e.message);
      return json({ error: "upstream" }, 502, headers);
    }
    console.error(e);
    return json({ error: "internal" }, 500, headers);
  }
});
