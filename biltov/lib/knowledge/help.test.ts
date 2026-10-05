import { describe, expect, it } from "vitest";
import { searchKnowledge } from "./features";

// Questions telles qu'un artisan les écrit (fautes, tournures orales) → fonctionnalité attendue.
const CASES: [string, string][] = [
  ["comment je fais pour créer un devis avec ma voix", "dictee-vocale"],
  ["le micro marche pas sur mon iphone", "dictee-vocale"],
  ["je veux parler pour faire un devis", "dictee-vocale"],
  ["comment relancer un client qui paie pas", "argent-a-recevoir"],
  ["qui me doit de l'argent", "argent-a-recevoir"],
  ["factures impayées", "argent-a-recevoir"],
  ["comment envoyer le devis par whatsapp", "envoi-et-signature"],
  ["je veux faire signer mon client sur le téléphone", "envoi-et-signature"],
  ["comment faire une facture d'acompte", "factures"],
  ["transformer le devis en facture", "factures"],
  ["annuler une facture déjà envoyée", "factures"],
  ["note de crédit", "factures"],
  ["importer mes prix depuis excel", "catalogue"],
  ["ajouter un article au catalogue", "catalogue"],
  ["augmenter tous mes prix de 5%", "catalogue"],
  ["sous-traitant sur une ligne du devis", "sous-traitance-par-ligne"],
  ["comment mettre ma marge sur chaque ligne", "sous-traitance-par-ligne"],
  ["voir si je gagne de l'argent sur un chantier", "rentabilite"],
  ["marge réelle du chantier", "rentabilite"],
  ["j'ai acheté plus de matériaux que prévu", "materiaux-prevu-reel"],
  ["comparer matériaux devis et factures", "materiaux-prevu-reel"],
  ["planning de la semaine de mes ouvriers", "planning"],
  ["déplacer un chantier dans le planning", "planning"],
  ["prendre des photos avant après", "photos-rapports"],
  ["faire signer le pv de réception", "photos-rapports"],
  ["donner un accès à ma secrétaire", "roles-et-acces"],
  ["ajouter un ouvrier avec un code pin", "roles-et-acces"],
  ["empêcher quelqu'un de voir les prix", "roles-et-acces"],
  ["les heures de mes ouvriers", "pointage"],
  ["notes de frais", "pointage"],
  ["importer un extrait de banque coda", "banque-coda"],
  ["rapprocher les paiements avec les factures", "banque-coda"],
  ["envoyer les écritures à mon comptable", "comptabilite"],
  ["export winbooks", "comptabilite"],
  ["scanner une facture fournisseur", "achats"],
  ["bon de commande fournisseur", "achats"],
  ["comment sauvegarder mes données", "sauvegarde"],
  ["j'ai changé de téléphone je retrouve plus mes chantiers", "sauvegarde"],
  ["combien ça coûte biltov", "abonnement"],
  ["essai gratuit carte bancaire", "compte-et-essai"],
  ["installer l'application sur mon iphone", "application-mobile"],
  ["mettre en néerlandais", "langues-theme"],
  ["entretien annuel chaudière contrat", "contrats-outils"],
  ["stock de la camionnette", "stock-flotte"],
  ["attestation onss de mon sous traitant", "sous-traitants"],
  ["où changer l'iban sur mes factures", "parametres"],
];

describe("chat d'aide : comprend les questions d'artisans", () => {
  it("trouve la bonne fiche en premier (au moins 95 %)", () => {
    const wrong = CASES.filter(([q, slug]) => searchKnowledge(q, 1)[0]?.slug !== slug).map(([q, slug]) => `${q} → ${searchKnowledge(q, 1)[0]?.slug ?? "—"} (attendu ${slug})`);
    console.log(`${CASES.length - wrong.length}/${CASES.length}`, wrong);
    expect(wrong.length / CASES.length).toBeLessThanOrEqual(0.05);
  });
  it("ne répond pas au hasard à une question hors sujet", () => {
    expect(searchKnowledge("quelle est la capitale de la france", 1)).toEqual([]);
    expect(searchKnowledge("recette de tarte aux pommes", 1)).toEqual([]);
  });
});

describe("réponses locales du chat", () => {
  it("adapte la réponse à la question et renvoie toujours vers un guide", async () => {
    const { localHelpAnswer } = await import("../ai");
    expect(localHelpAnswer("où changer l'iban sur mes factures")).toContain("/fonctionnalites/parametres/");
    expect(localHelpAnswer("le micro marche pas sur mon iphone")).toContain("Safari");
    expect(localHelpAnswer("comment relancer un client")).toMatch(/1\. Ouvrez Argent à recevoir/);
    expect(localHelpAnswer("blablabla zzz")).toContain("/fonctionnalites/dictee-vocale/");
  });
});
