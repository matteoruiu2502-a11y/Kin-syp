// Contrôles et mentions légales (droit français) pour devis et factures du BTP.

import type { Company, Doc, Job } from "./types";

const digits = (s: string) => s.replace(/\D/g, "");

/** Clé de Luhn (SIREN / SIRET). La Poste (356 000 000) fait exception. */
export function luhnValid(value: string) {
  const d = digits(value);
  if (d.startsWith("356000000")) return true;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
}

export const isSiret = (v: string) => digits(v).length === 14 && luhnValid(v);
export const isSiren = (v: string) => digits(v).length === 9 && luhnValid(v);

/** Numéro de TVA intracommunautaire français déduit du SIREN : FR + clé + SIREN. */
export function frVatFromSiren(siren: string) {
  const s = digits(siren).slice(0, 9);
  if (s.length !== 9) return "";
  const key = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${s}`;
}

export function isFrVat(v: string) {
  const clean = v.replace(/\s/g, "").toUpperCase();
  return /^FR\d{11}$/.test(clean) && frVatFromSiren(clean.slice(4)) === clean;
}

export function isIban(v: string) {
  const s = v.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of moved) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export const formatSiret = (v: string) => digits(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{0,5}).*/, "$1 $2 $3 $4").trim();
export const formatIban = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 34).replace(/(.{4})/g, "$1 ").trim();

/** Champs d'entreprise indispensables avant d'émettre un devis ou une facture. */
export function missingCompanyFields(c: Company): (keyof Company)[] {
  const missing: (keyof Company)[] = [];
  const req: (keyof Company)[] = ["name", "owner", "address", "postcode", "city", "email", "siret", "insurer", "policyNumber", "coverage"];
  for (const k of req) if (!String(c[k] ?? "").trim()) missing.push(k);
  if (c.siret && !isSiret(c.siret)) missing.push("siret");
  if (c.vatMode === "normal" && !c.vatNumber.trim()) missing.push("vatNumber");
  return [...new Set(missing)];
}

export const isMicro = (c: Company) => c.legalForm === "EI (micro-entreprise)";

/** Ligne d'identification légale de l'entreprise (en-tête / pied de page). */
export function companyLegalLine(c: Company) {
  const parts = [
    c.legalForm === "EI" || isMicro(c) ? `${c.owner} — Entrepreneur individuel (EI)` : `${c.legalForm}${c.capital ? ` au capital de ${c.capital}` : ""}`,
    `SIRET ${formatSiret(c.siret)}`,
    c.registry,
    c.vatMode === "normal" && c.vatNumber ? `TVA ${c.vatNumber.replace(/\s/g, "")}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

export type Mentions = { conditions: string[]; legal: string[] };

/** Mentions obligatoires ou recommandées, selon le document, le client et l'entreprise. */
export function buildMentions(doc: Doc, job: Job, c: Company, opts: { depositPercent: number; paymentTermsDays: number; freeQuote: boolean; usesReducedVat: boolean }): Mentions {
  const conditions: string[] = [];
  const legal: string[] = [];
  const b2c = job.clientType === "particulier";

  if (c.vatMode === "franchise") legal.push("TVA non applicable, art. 293 B du CGI.");
  else if (job.reverseCharge) legal.push("Autoliquidation — TVA due par le preneur, art. 283-2 nonies du CGI (sous-traitance BTP).");
  if (c.vatMode === "normal" && c.vatOnDebits && doc.type !== "quote") legal.push("Option pour le paiement de la taxe d'après les débits.");
  if (opts.usesReducedVat)
    legal.push(
      doc.type === "quote"
        ? "Taux réduit de TVA (art. 279-0 bis / 278-0 bis A du CGI) : le client certifie que les travaux portent sur un local à usage d'habitation achevé depuis plus de deux ans ; cette attestation vaut par sa signature du présent devis."
        : "Taux réduit de TVA (art. 279-0 bis / 278-0 bis A du CGI) appliqué sur attestation du client : local à usage d'habitation achevé depuis plus de deux ans.",
    );

  if (doc.type === "quote") {
    conditions.push(`Devis ${opts.freeQuote ? "gratuit" : "payant"}, valable jusqu'au ${fmtDate(doc.validUntil)}.`);
    if (doc.depositPercent > 0)
      conditions.push(
        b2c && job.offPremises
          ? `Acompte de ${doc.depositPercent} %, exigible à l'expiration d'un délai de 7 jours suivant la signature, solde à réception de la facture de fin de travaux.`
          : `Acompte de ${doc.depositPercent} % à la signature, solde à réception de la facture de fin de travaux.`,
      );
    else conditions.push("Paiement à réception de la facture de fin de travaux.");
    if (job.startDate || job.duration)
      conditions.push(`Début des travaux prévu : ${job.startDate ? fmtDate(job.startDate) : "à convenir"}${job.duration ? ` · durée estimée : ${job.duration}` : ""}.`);
    if (b2c && job.offPremises)
      legal.push(
        "Contrat conclu hors établissement : le client dispose d'un délai de rétractation de 14 jours (art. L221-18 du Code de la consommation). Aucun paiement ne peut être exigé avant l'expiration d'un délai de 7 jours (art. L221-10).",
      );
  } else {
    conditions.push(`Échéance de paiement : ${fmtDate(doc.dueDate)}. Pas d'escompte pour paiement anticipé.`);
    conditions.push(
      b2c
        ? "En cas de retard de paiement, pénalités au taux d'intérêt légal majoré, conformément à la réglementation."
        : "En cas de retard : pénalités au taux directeur de la BCE majoré de 10 points (art. L441-10 du Code de commerce) et indemnité forfaitaire pour frais de recouvrement de 40 € (art. D441-5).",
    );
    legal.push("Catégorie de l'opération : prestation de services.");
  }

  if (b2c && c.mediatorName)
    legal.push(
      `Médiation de la consommation (art. L612-1 du Code de la consommation) : en cas de litige, le client peut recourir gratuitement au médiateur ${c.mediatorName}${c.mediatorUrl ? ` — ${c.mediatorUrl}` : ""}.`,
    );
  if (c.insurer)
    legal.push(
      `Assurance décennale / RC professionnelle : ${c.insurer}${c.insurerContact ? `, ${c.insurerContact}` : ""} — contrat n° ${c.policyNumber} — couverture géographique : ${c.coverage}.`,
    );
  return { conditions, legal };
}

export const fmtDate = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR") : "—");
