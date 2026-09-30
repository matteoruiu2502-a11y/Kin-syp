// Table de configuration légale datée — SEULE source des taux, montants et dates.
// Chaque valeur porte sa source et un indicateur « verified » : false = à confirmer
// par un comptable / le SPF Finances avant usage commercial (affiché dans l'app).

export type LegalValue<T> = { value: T; validFrom: string; validTo?: string; source: string; verified: boolean };

type Table = Record<string, LegalValue<unknown>[]>;

export const LEGAL_TABLE = {
  "vat.rates": [{ value: [21, 12, 6, 0], validFrom: "1996-01-01", source: "Code TVA, AR n° 20 (tableaux A et B)", verified: true }],
  "vat.renovation6.minAgeYears": [{ value: 10, validFrom: "2016-01-01", source: "AR n° 20, tableau A, rubrique XXXI (logements de 10 ans)", verified: true }],
  "vat.fossilBoiler.standardFrom": [
    { value: "2025-07-29", validFrom: "2025-07-29", source: "Cahier des charges Biltov — installation de chaudières à combustibles fossiles au taux normal (à vérifier sur fin.belgium.be)", verified: false },
  ],
  "vat.heatPump.rate": [{ value: 6, validFrom: "2022-04-01", source: "Mesure temporaire pompes à chaleur (prolongations successives — à vérifier)", verified: false }],
  "vat.franchise.threshold": [{ value: 25000, validFrom: "2025-01-01", source: "Art. 56bis Code TVA (seuil de la franchise — à vérifier)", verified: false }],
  "invoice.retentionYears": [{ value: 10, validFrom: "2023-01-01", source: "Art. 60 Code TVA (conservation des factures — à vérifier)", verified: false }],
  "peppol.b2bMandatoryFrom": [{ value: "2026-01-01", validFrom: "2026-01-01", source: "Loi du 6 février 2024 (facturation électronique B2B)", verified: false }],
  // Livre XIX du Code de droit économique — dettes du consommateur
  "b2c.graceDays": [{ value: 14, validFrom: "2022-07-01", source: "CDE art. XIX.2 (délai de 14 jours après le premier rappel gratuit)", verified: true }],
  "b2c.postalStartBusinessDays": [{ value: 3, validFrom: "2022-07-01", source: "CDE art. XIX.2 (envoi papier : 3e jour ouvrable)", verified: false }],
  "b2c.indemnityScale": [
    {
      value: [
        { upTo: 150, fixed: 20, percentAbove: 0, base: 0 },
        { upTo: 500, fixed: 30, percentAbove: 10, base: 150 },
        { upTo: Infinity, fixed: 65, percentAbove: 5, base: 500, max: 2000 },
      ],
      validFrom: "2022-07-01",
      source: "CDE art. XIX.4 (plafonds des indemnités — à vérifier)",
      verified: false,
    },
  ],
  "b2c.interestPointsAboveLegal": [{ value: 8, validFrom: "2022-07-01", source: "CDE art. XIX.4 (intérêts ≤ taux légal + 8 points — à vérifier)", verified: false }],
  "legal.interestRate": [{ value: 4.5, validFrom: "2025-01-01", source: "Taux d'intérêt légal annuel (Moniteur belge) — valeur à mettre à jour", verified: false }],
  // Loi du 2 août 2002 — retard de paiement entre entreprises
  "b2b.commercialRate": [{ value: 10.5, validFrom: "2025-07-01", source: "Taux d'intérêt commercial semestriel (SPF Économie) — valeur à mettre à jour", verified: false }],
  "b2b.flatIndemnity": [{ value: 40, validFrom: "2013-03-16", source: "Loi du 2 août 2002, art. 6 (indemnité forfaitaire minimale)", verified: true }],
  // Obligation de retenue (construction)
  "retention.taxPercent": [{ value: 15, validFrom: "2008-01-01", source: "CIR 92 art. 403 (dettes fiscales)", verified: true }],
  "retention.onssPercent": [{ value: 35, validFrom: "2008-01-01", source: "Loi ONSS art. 30bis (dettes sociales)", verified: true }],
  "retention.inastiPercent": [{ value: 15, validFrom: "2026-10-01", source: "Volet INASTI — date divergente selon les sources (01/05 ou 01/10/2026)", verified: false }],
  "retention.maxPercent": [{ value: 50, validFrom: "2026-10-01", source: "Plafond cumulé des retenues (à vérifier)", verified: false }],
} satisfies Table;

export type LegalKey = keyof typeof LEGAL_TABLE;
type ValueOf<K extends LegalKey> = (typeof LEGAL_TABLE)[K][number]["value"];

/** Valeur en vigueur à une date donnée (AAAA-MM-JJ). */
export function legal<K extends LegalKey>(key: K, date = new Date().toISOString().slice(0, 10)): ValueOf<K> {
  const rows = LEGAL_TABLE[key] as LegalValue<ValueOf<K>>[];
  const row = [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).find((r) => r.validFrom <= date && (!r.validTo || r.validTo >= date)) ?? rows[0];
  return row.value;
}

export function legalRow(key: LegalKey, date = new Date().toISOString().slice(0, 10)) {
  const rows = LEGAL_TABLE[key] as LegalValue<unknown>[];
  return [...rows].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).find((r) => r.validFrom <= date) ?? rows[0];
}

/** Valeurs non confirmées : affichées dans les paramètres pour validation par un comptable. */
export const unverifiedValues = () =>
  (Object.entries(LEGAL_TABLE) as [string, LegalValue<unknown>[]][]).flatMap(([key, rows]) => rows.filter((r) => !r.verified).map((r) => ({ key, ...r })));
