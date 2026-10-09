import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DICT } from "./tr-dict";

// Chaque texte littéral passé à t() dans l'espace artisan doit avoir sa traduction NL et DE.
const files = (dir: string) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts")).map((f) => join(dir, f));
const LITERAL = /\bt\(\s*"((?:[^"\\]|\\.)*)"/g;

describe("traductions de l'interface", () => {
  const src = [...files(join(__dirname, "../../components/app")), ...files(__dirname), ...files(join(__dirname, "../../mode-3d"))];
  const used = new Set(src.flatMap((f) => [...readFileSync(f, "utf8").matchAll(LITERAL)].map((m) => JSON.parse(`"${m[1]}"`) as string)));
  it("tous les textes ont une traduction NL et DE", () => {
    const missing = [...used].filter((s) => s && !DICT[s]);
    expect(missing).toEqual([]);
  });
  it("les variables {x} sont conservées", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const broken = Object.entries(DICT).filter(([fr, [nl, de]]) => vars(fr) !== vars(nl) || vars(fr) !== vars(de));
    expect(broken).toEqual([]);
  });
});
