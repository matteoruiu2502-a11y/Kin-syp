import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURES } from "./knowledge/features";
import { VIDEOS } from "./videos";

describe("vidéos", () => {
  it("chaque fichier déclaré existe et chaque page cible est valide", () => {
    const pages = new Set(["accueil", "fonctionnalites", ...FEATURES.map((f) => `fonctionnalites/${f.slug}`)]);
    for (const v of VIDEOS) {
      if (v.file) expect(existsSync(join(__dirname, "../public/videos", v.file)), v.file).toBe(true);
      if (v.poster) expect(existsSync(join(__dirname, "../public/videos", v.poster)), v.poster).toBe(true);
      for (const p of v.pages) expect(pages.has(p), p).toBe(true);
    }
  });
});
