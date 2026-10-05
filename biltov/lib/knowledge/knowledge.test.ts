import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, FEATURES, knowledgeMarkdown, searchKnowledge } from "./features";

describe("base de connaissances", () => {
  it("chaque fonctionnalité est complète et a un identifiant unique", () => {
    const slugs = new Set<string>();
    for (const f of FEATURES) {
      expect(f.slug).toMatch(/^[a-z0-9-]+$/);
      expect(slugs.has(f.slug)).toBe(false);
      slugs.add(f.slug);
      expect(CATEGORIES.some((c) => c.id === f.category)).toBe(true);
      expect(f.what.length).toBeGreaterThan(40);
      expect(f.steps.length).toBeGreaterThan(0);
      expect(f.where.length).toBeGreaterThan(5);
    }
  });

  it("le fichier knowledge/biltov-features.md est à jour (npm run knowledge)", () => {
    const md = readFileSync(join(__dirname, "../../knowledge/biltov-features.md"), "utf8");
    expect(md).toBe(knowledgeMarkdown());
  });

  it("la recherche trouve la bonne fonctionnalité", () => {
    expect(searchKnowledge("comment relancer un client qui n'a pas payé")[0].slug).toBe("argent-a-recevoir");
    expect(searchKnowledge("le micro ne marche pas pour dicter")[0].slug).toBe("dictee-vocale");
    expect(searchKnowledge("importer mes prix excel")[0].slug).toBe("catalogue");
  });
});
