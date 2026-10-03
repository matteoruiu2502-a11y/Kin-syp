// Moteur de TVA belge : seule source de vérité pour le taux d'une ligne.
// L'artisan confirme toujours le résultat (surcharge possible, tracée).

import { legal } from "./config";

export type Lang = "fr" | "nl" | "de";

/** Codes de TVA d'une ligne. */
export type VatCode = "21" | "12" | "6" | "0" | "exempt" | "reverse" | "franchise";
export const VAT_CODES: VatCode[] = ["21", "12", "6", "0", "exempt", "reverse", "franchise"];

export const vatRate = (code: VatCode) => (code === "21" ? 21 : code === "12" ? 12 : code === "6" ? 6 : 0);

/** Type de client, déterminant pour le taux et pour Peppol. */
export type ClientKind = "particulier" | "assujetti" | "franchise" | "public" | "etranger";

/** Nature d'une ligne. */
export type LineCategory = "labour" | "installed_material" | "supply_only" | "fossil_boiler_install" | "fossil_boiler_service" | "heat_pump" | "garden_creation" | "garden_maintenance" | "other";

export type VatContext = {
  date: string; // date de la (première) facture
  companyRegime: "normal" | "franchise";
  clientKind: ClientKind;
  workKind: "immobilier" | "livraison";
  privateHousing: boolean; // logement privé (exclusivement ou principalement)
  firstOccupationYear: number | null;
};

export type VatDecision = { code: VatCode; reason: string; warning?: string };

/** Âge « fiscal » du logement : année de la facture − année civile de première occupation. */
export const housingAge = (ctx: Pick<VatContext, "date" | "firstOccupationYear">) =>
  ctx.firstOccupationYear ? Number(ctx.date.slice(0, 4)) - ctx.firstOccupationYear : null;

export function renovation6Eligible(ctx: VatContext) {
  const age = housingAge(ctx);
  return ctx.clientKind === "particulier" && ctx.workKind === "immobilier" && ctx.privateHousing && age !== null && age >= legal("vat.renovation6.minAgeYears", ctx.date);
}

export function decideVat(ctx: VatContext, category: LineCategory): VatDecision {
  if (ctx.companyRegime === "franchise") return { code: "franchise", reason: "Entreprise sous le régime de franchise des petites entreprises : pas de TVA facturée." };

  if (ctx.clientKind === "etranger")
    return { code: "21", reason: "Client étranger : taux normal par défaut.", warning: "Règles de localisation à vérifier (autoliquidation possible si le client est assujetti UE)." };

  // Parcs & jardins : l'entretien est une prestation de services, l'aménagement de jardin est exclu du 6 %.
  if (category === "garden_maintenance") return { code: "21", reason: "Entretien de jardin (tonte, taille…) : prestation de services au taux normal.", warning: "Règle « jardin » à valider par votre comptable." };
  if (category === "garden_creation") {
    if (ctx.clientKind === "assujetti") return { code: "reverse", reason: "Aménagement de jardin pour un assujetti déposant : autoliquidation par le client si les travaux sont immobiliers.", warning: "Qualification « travaux immobiliers » à valider par votre comptable." };
    return { code: "21", reason: "Création / aménagement de jardin : exclu du taux réduit de 6 %, taux normal.", warning: "Règle « jardin » à valider par votre comptable." };
  }

  const immovable = ctx.workKind === "immobilier" && category !== "supply_only";

  // Autoliquidation : travaux immobiliers pour un assujetti belge déposant des déclarations périodiques
  if (ctx.clientKind === "assujetti" && immovable) return { code: "reverse", reason: "Travaux immobiliers pour un assujetti déposant : autoliquidation par le client." };

  if (category === "supply_only") return { code: "21", reason: "Fourniture sans pose : taux normal." };

  if (renovation6Eligible(ctx)) {
    if (category === "fossil_boiler_install" && ctx.date >= legal("vat.fossilBoiler.standardFrom", ctx.date))
      return { code: "21", reason: "Installation d'une chaudière à combustible fossile : taux normal (exclue du 6 %)." };
    if (category === "heat_pump") {
      const r = legal("vat.heatPump.rate", ctx.date);
      return { code: r === 6 ? "6" : "21", reason: `Pompe à chaleur : régime configuré à ${r} %.`, warning: "Régime temporaire : vérifier sa validité à la date de facturation." };
    }
    return { code: "6", reason: "Rénovation d'un logement privé de 10 ans et plus, facturée au consommateur final (main-d'œuvre et matériaux posés)." };
  }

  const age = housingAge(ctx);
  const why =
    ctx.clientKind !== "particulier"
      ? "client non consommateur final"
      : ctx.workKind !== "immobilier"
        ? "livraison de biens"
        : !ctx.privateHousing
          ? "bâtiment non affecté au logement privé"
          : age === null
            ? "année de première occupation inconnue"
            : `logement de ${age} an(s) (< ${legal("vat.renovation6.minAgeYears", ctx.date)})`;
  return {
    code: "21",
    reason: `Taux normal : ${why}.`,
    warning: ctx.clientKind === "public" ? "Pouvoir public : vérifier les régimes particuliers (logement social, etc.)." : ctx.clientKind === "franchise" ? "Client en franchise : vérifier s'il agit comme consommateur final." : undefined,
  };
}
