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

describe("questions de clarification", () => {
  const pl = {
    lang: "fr" as const,
    articles: [
      newArticle({ id: "cu15", name: { fr: "Tube cuivre Ø15", nl: "", de: "" }, unit: "ml", salePrice: 8, purchasePrice: 5 }),
      newArticle({ id: "cu22", name: { fr: "Tube cuivre Ø22", nl: "", de: "" }, unit: "ml", salePrice: 12, purchasePrice: 8 }),
      newArticle({ id: "mit", name: { fr: "Mitigeur lavabo", nl: "", de: "" }, unit: "u", salePrice: 84, purchasePrice: 60 }),
    ],
  };
  const go = (draft: VoiceDraft, text: string, pending: Parameters<typeof interpretLocally>[2]) => applyActions(draft, interpretLocally(text, draft, pending, pl), pl);

  it("tuyau sans diamètre ni longueur : demande le diamètre, puis la longueur, sans rien mélanger", () => {
    let d = go({ client: null, lines: [] }, "pour Mme Claes, du tuyau cuivre et un mitigeur lavabo", null);
    expect(d.client).toBe("Mme Claes");
    expect(d.lines).toHaveLength(2);
    let q = nextQuestion(d)!;
    expect(q.pending.kind).toBe("choice");
    expect(q.chips).toEqual(["Tube cuivre Ø15", "Tube cuivre Ø22", "Aucun de ceux-là"]);
    d = go(d, "le 22", q.pending);
    expect(d.lines[0]).toMatchObject({ articleId: "cu22", label: "Tube cuivre Ø22", unit: "ml", unitPrice: 12 });
    q = nextQuestion(d)!;
    expect(q.pending.kind).toBe("qty");
    expect(q.text).toBe("Combien de mètres pour « Tube cuivre Ø22 » ?");
    d = go(d, "15 mètres", q.pending);
    expect(d.lines[0]).toMatchObject({ qty: 15, unit: "ml" });
    expect(d.lines[1]).toMatchObject({ articleId: "mit", qty: 1, unitPrice: 84 });
    expect(nextQuestion(d)).toBeNull();
  });

  it("réponse par le nom, par le rang, ou « aucun »", () => {
    const base = go({ client: "M. X", lines: [] }, "10 mètres de tuyau cuivre", null);
    const q = nextQuestion(base)!;
    expect(go(base, "Tube cuivre Ø15", q.pending).lines[0].articleId).toBe("cu15");
    expect(go(base, "le deuxième", q.pending).lines[0].articleId).toBe("cu22");
    const free = go(base, "aucun de ceux-là", q.pending);
    expect(free.lines[0]).toMatchObject({ articleId: null, toPrice: true, qty: 10, unit: "ml" });
    expect(nextQuestion(free)!.pending.kind).toBe("price");
  });

  it("le prix dicté est conservé quand l'artisan choisit l'article", () => {
    const base = go({ client: "M. X", lines: [] }, "10 mètres de tuyau cuivre à 9 euros du mètre", null);
    expect(go(base, "le 15", nextQuestion(base)!.pending).lines[0]).toMatchObject({ articleId: "cu15", unitPrice: 9 });
  });
});
