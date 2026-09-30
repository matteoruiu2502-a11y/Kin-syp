// Mentions obligatoires des factures belges, en FR / NL / DE.
// FR : texte du cahier des charges. NL / DE : traductions à confirmer avec les textes officiels du SPF Finances.

import type { Lang, VatCode } from "./vat";

export const MENTIONS: Record<"vat6" | "reverse" | "franchise" | "exempt", Record<Lang, string>> = {
  vat6: {
    fr: "Taux de TVA : En l'absence de contestation par écrit, dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à un bâtiment d'habitation dont la première occupation a eu lieu au cours d'une année civile qui précède d'au moins dix ans la date de la première facture relative à ces travaux, (2) qu'après l'exécution de ces travaux, l'habitation est utilisée, soit exclusivement soit à titre principal comme logement privé et (3) que ces travaux sont fournis et facturés à un consommateur final. Si au moins une de ces conditions n'est pas remplie, le taux normal de TVA de 21 p.c. sera applicable et le client endossera, par rapport à ces conditions, la responsabilité quant au paiement de la taxe, des intérêts et des amendes dus.",
    nl: "Btw-tarief: Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming heeft plaatsgevonden in een kalenderjaar dat ten minste tien jaar voorafgaat aan de datum van de eerste factuur met betrekking tot die werken, (2) de woning, na uitvoering van die werken, uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt en (3) de werken worden verstrekt en gefactureerd aan een eindverbruiker. Wanneer minstens één van die voorwaarden niet is voldaan, zal het normale btw-tarief van 21 pct. van toepassing zijn en is de afnemer ten aanzien van die voorwaarden aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.",
    de: "MwSt.-Satz: In Ermangelung einer schriftlichen Beanstandung binnen einer Frist von einem Monat ab Empfang der Rechnung wird davon ausgegangen, dass der Kunde anerkennt, dass (1) die Arbeiten an einer Wohnung ausgeführt werden, deren Erstbezug in einem Kalenderjahr erfolgt ist, das mindestens zehn Jahre vor dem Datum der ersten Rechnung über diese Arbeiten liegt, (2) die Wohnung nach Ausführung dieser Arbeiten ausschließlich oder hauptsächlich als Privatwohnung genutzt wird und (3) diese Arbeiten an einen Endverbraucher erbracht und ihm in Rechnung gestellt werden. Ist mindestens eine dieser Bedingungen nicht erfüllt, gilt der normale MwSt.-Satz von 21 Prozent und übernimmt der Kunde in Bezug auf diese Bedingungen die Haftung für die Zahlung der geschuldeten Steuer, Zinsen und Geldbußen.",
  },
  reverse: {
    fr: "Autoliquidation. En l'absence de contestation par écrit, dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître qu'il est un assujetti tenu au dépôt de déclarations périodiques. Si cette condition n'est pas remplie, le client endossera, par rapport à cette condition, la responsabilité quant au paiement de la taxe, des intérêts et des amendes dus.",
    nl: "Verlegging van heffing. Bij gebrek aan schriftelijke betwisting binnen een termijn van één maand vanaf de ontvangst van de factuur, wordt de klant geacht te erkennen dat hij een belastingplichtige is gehouden tot het indienen van periodieke aangiften. Als die voorwaarde niet vervuld is, is de klant ten aanzien van die voorwaarde aansprakelijk voor de betaling van de verschuldigde belasting, interesten en geldboeten.",
    de: "Verlagerung der Steuerschuldnerschaft. In Ermangelung einer schriftlichen Beanstandung binnen einer Frist von einem Monat ab Empfang der Rechnung wird davon ausgegangen, dass der Kunde anerkennt, dass er ein Steuerpflichtiger ist, der zur Abgabe periodischer Erklärungen verpflichtet ist. Ist diese Bedingung nicht erfüllt, übernimmt der Kunde in Bezug auf diese Bedingung die Haftung für die Zahlung der geschuldeten Steuer, Zinsen und Geldbußen.",
  },
  franchise: {
    fr: "Régime particulier de franchise des petites entreprises.",
    nl: "Bijzondere vrijstellingsregeling kleine ondernemingen.",
    de: "Sonderregelung für Kleinunternehmen.",
  },
  exempt: {
    fr: "Opération exemptée de TVA.",
    nl: "Vrijgestelde handeling.",
    de: "Steuerbefreiter Umsatz.",
  },
};

/** Mentions à imprimer selon les codes de TVA utilisés sur le document. */
export function mentionsFor(codes: VatCode[], lang: Lang) {
  const set = new Set(codes);
  const out: string[] = [];
  if (set.has("6")) out.push(MENTIONS.vat6[lang]);
  if (set.has("reverse")) out.push(MENTIONS.reverse[lang]);
  if (set.has("franchise")) out.push(MENTIONS.franchise[lang]);
  if (set.has("exempt")) out.push(MENTIONS.exempt[lang]);
  return out;
}
