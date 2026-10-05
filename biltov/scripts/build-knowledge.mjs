// Génère, à partir de lib/knowledge/features.ts (source unique) :
// - knowledge/biltov-features.md : la base lisible (et versionnée) ;
// - supabase/functions/biltov-ai/knowledge.ts : la base embarquée dans la fonction serveur du chat.
// Node ≥ 22.6 lit le TypeScript directement (suppression des types).
import { mkdirSync, writeFileSync } from "node:fs";

const { knowledgeMarkdown } = await import("../lib/knowledge/features.ts");
const md = knowledgeMarkdown();
mkdirSync("knowledge", { recursive: true });
writeFileSync("knowledge/biltov-features.md", md);
mkdirSync("supabase/functions/biltov-ai", { recursive: true });
writeFileSync("supabase/functions/biltov-ai/knowledge.ts", `// Fichier généré par scripts/build-knowledge.mjs — ne pas modifier à la main.\nexport const KNOWLEDGE = ${JSON.stringify(md)};\n`);
console.log(`Base de connaissances : ${md.length} caractères`);
