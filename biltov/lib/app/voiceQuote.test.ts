import { describe, expect, it } from "vitest";
import { newArticle } from "./defaults";
import { applyActions, extractClient, findLine, interpretLocally, nextQuestion, type VoiceDraft } from "./voiceQuote";

const cat = {
  lang: "fr" as const,
  articles: [
    newArticle({ id: "par", name: { fr: "Parquet chêne", nl: "", de: "" }, unit: "m²", salePrice: 45, purchasePrice: 30, category: "installed_material" }),
    newArticle({ id: "mo", name: { fr: "Main-d'œuvre", nl: "", de: "" }, unit: "h", salePrice: 50, purchasePrice: 35, type: "labour", category: "labour" }),
  ],
};
const empty: VoiceDraft = { client: null, lines: [] };

const step = (draft: VoiceDraft, text: string, pending: Parameters<typeof interpretLocally>[2] = null) => applyActions(draft, interpretLocally(text, draft, pending, cat), cat);

describe("dictée vocale en conversation", () => {
  it("client dicté sans virgule (transcription)", () => {
    expect(extractClient("pour madame Peeters pose de 24 m² de parquet").client).toBe("Mme Peeters");
    expect(extractClient("Pour Monsieur Jean Dubois, 3 prises").client).toBe("M. Jean Dubois");
    expect(extractClient("24 m² de parquet").client).toBeNull();
  });

  it("description → lignes avec les prix du catalogue, puis questions manquantes", () => {
    let d = step(empty, "24 m² de parquet chêne et 6 heures de main-d'œuvre et 12 mètres de plinthes");
    expect(d.lines).toHaveLength(3);
    expect(d.lines[0]).toMatchObject({ qty: 24, unitPrice: 45 });
    // client manquant → question
    let q = nextQuestion(d)!;
    expect(q.pending).toEqual({ kind: "client" });
    d = step(d, "madame Peeters", q.pending);
    expect(d.client).toBe("Mme Peeters");
    // plinthes sans prix ni catalogue → question de prix
    q = nextQuestion(d)!;
    expect(q.pending).toMatchObject({ kind: "price" });
    expect(q.text).toContain("Plinthes");
    d = step(d, "9 euros", q.pending);
    expect(d.lines.find((l) => /plinthe/i.test(l.label))).toMatchObject({ unitPrice: 9, toPrice: false });
    expect(nextQuestion(d)).toBeNull();
  });

  it("corrections à la voix", () => {
    let d = step(empty, "pour Mme Martin, 20 m² de peinture murale à 22 euros, 3 heures de main-d'œuvre");
    expect(d.client).toBe("Mme Martin");
    d = step(d, "change le prix de la peinture à 45 €");
    expect(d.lines.find((l) => /peinture/i.test(l.label))!.unitPrice).toBe(45);
    d = step(d, "ajoute 2 heures de main-d'œuvre");
    expect(d.lines.filter((l) => l.unit === "h")).toHaveLength(2);
    d = step(d, "mets 30 m² de peinture");
    expect(d.lines.find((l) => /peinture/i.test(l.label))!.qty).toBe(30);
    d = step(d, "supprime la peinture");
    expect(d.lines.some((l) => /peinture/i.test(l.label))).toBe(false);
    const r = interpretLocally("supprime le carrelage", d, null, cat);
    expect(r.actions).toHaveLength(0);
    expect(r.reply).toContain("Je ne trouve pas");
  });

  it("question ignorée (« je ne sais pas ») : on passe à la suite", () => {
    const d = step(empty, "pour Mme Claes, 4 radiateurs");
    const q = nextQuestion(d)!;
    expect(q.pending).toMatchObject({ kind: "price" });
    expect(nextQuestion(d, [(q.pending as { lineId: string }).lineId])).toBeNull();
  });

  it("actions du serveur IA appliquées avec le catalogue", () => {
    const d = applyActions(empty, { client: "M. Dupont", actions: [{ op: "add", lineId: null, label: "Parquet chêne", qty: 10, unit: "m²", unitPrice: null }] }, cat);
    expect(d.lines[0]).toMatchObject({ articleId: "par", qty: 10, unitPrice: 45, costPrice: 30 });
    expect(findLine(d.lines, "le parquet")!.id).toBe(d.lines[0].id);
  });
});
