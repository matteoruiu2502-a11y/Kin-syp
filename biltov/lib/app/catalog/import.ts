// Import de tableaux Excel / CSV : lecture (UTF-8 ou Windows-1252, « ; » ou « , »),
// nombres belges (« 1.234,56 € »), mapping automatique des colonnes FR / NL / DE / EN,
// validation ligne par ligne, simulation, doublons, rapport d'erreurs.

import Papa from "papaparse";
import { newArticle, newClient, todayIso } from "../defaults";
import { round2 } from "../money";
import type { Article, ArticleType, Client, ClientKind, Lang, LineCategory } from "../types";
import { recalcAll } from "./pricing";

export type Table = { headers: string[]; rows: string[][] };

// ——— Lecture ——————————————————————————————————————————————————————————————

/** Décode un CSV : UTF-8 si valide, sinon Windows-1252 (exports Excel belges). */
export function decodeCsv(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8.replace(/^﻿/, "");
}

export function parseCsvText(text: string): Table {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"] });
  const [headers = [], ...rows] = res.data;
  return { headers: headers.map((h) => String(h).trim()), rows: rows.map((r) => r.map((c) => String(c ?? "").trim())) };
}

export async function readTable(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new Error("Ancien format .xls : ouvrez le fichier dans Excel et enregistrez-le en .xlsx (ou .csv), puis réessayez.");
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) {
        const v = row.getCell(c).value;
        const text =
          v === null || v === undefined
            ? ""
            : typeof v === "object"
              ? "result" in v
                ? String(v.result ?? "")
                : "richText" in v
                  ? v.richText.map((t) => t.text).join("")
                  : v instanceof Date
                    ? v.toISOString().slice(0, 10)
                    : "text" in v
                      ? String(v.text)
                      : String(v)
              : String(v);
        cells.push(text.trim());
      }
      rows.push(cells);
    });
    const [headers = [], ...data] = rows;
    return { headers, rows: data.filter((r) => r.some(Boolean)) };
  }
  return parseCsvText(decodeCsv(await file.arrayBuffer()));
}

/** « 12,50 € », « 1.234,56 », « 1 234,56 », « 1,234.56 », « 12.5 » → nombre. */
export function parseNumber(input: string | number | undefined): number | null {
  if (input === undefined || input === null) return null;
  if (typeof input === "number") return input;
  let s = input.replace(/[€\s  ]|eur/gi, "").replace(/%$/, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma > -1) s = s.replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ——— Champs et mapping ———————————————————————————————————————————————————

export type FieldDef = { key: string; label: string; required?: boolean; type: "text" | "number" | "enum"; values?: string[]; synonyms: string[] };

export const ARTICLE_FIELDS: FieldDef[] = [
  { key: "ref", label: "Référence", type: "text", synonyms: ["ref", "reference", "référence", "code", "article", "artikel", "artikelnummer", "referentie", "sku", "code article"] },
  { key: "name_fr", label: "Désignation FR", required: true, type: "text", synonyms: ["designation", "désignation", "libelle", "libellé", "description", "nom", "produit", "name", "omschrijving fr", "designation fr", "libelle fr"] },
  { key: "name_nl", label: "Désignation NL", type: "text", synonyms: ["omschrijving", "benaming", "naam", "designation nl", "nl", "omschrijving nl"] },
  { key: "name_de", label: "Désignation DE", type: "text", synonyms: ["bezeichnung", "beschreibung", "designation de", "de"] },
  { key: "family", label: "Famille", type: "text", synonyms: ["famille", "categorie", "catégorie", "category", "groupe", "familie", "categorie nl", "kategorie", "warengruppe", "productgroep"] },
  { key: "unit", label: "Unité", type: "text", synonyms: ["unite", "unité", "unit", "eenheid", "einheit", "u", "uom"] },
  { key: "purchasePrice", label: "Prix d'achat HTVA", type: "number", synonyms: ["prix achat", "prix d'achat", "achat", "cout", "coût", "purchase", "aankoopprijs", "inkoopprijs", "einkaufspreis", "prix net", "netto", "prix fournisseur"] },
  { key: "marginPercent", label: "Marge %", type: "number", synonyms: ["marge", "margin", "coefficient", "winstmarge", "aufschlag"] },
  { key: "salePrice", label: "Prix de vente HTVA", type: "number", synonyms: ["prix vente", "prix de vente", "vente", "pv", "prix", "price", "verkoopprijs", "prijs", "verkaufspreis", "preis", "tarif", "prix public"] },
  { key: "type", label: "Type", type: "enum", values: ["fourniture", "main-d'oeuvre", "location", "sous-traitance", "forfait"], synonyms: ["type", "nature", "soort", "art"] },
  { key: "supplierRef", label: "Réf. fournisseur", type: "text", synonyms: ["ref fournisseur", "référence fournisseur", "leveranciersreferentie", "lieferantennummer"] },
  { key: "ean", label: "EAN", type: "text", synonyms: ["ean", "gtin", "code barre", "barcode", "streepjescode"] },
  { key: "vat", label: "Catégorie TVA", type: "enum", values: ["pose", "fourniture seule", "main-d'oeuvre"], synonyms: ["tva", "btw", "mwst", "vat"] },
];

export const CLIENT_FIELDS: FieldDef[] = [
  { key: "name", label: "Nom / raison sociale", required: true, type: "text", synonyms: ["nom", "name", "naam", "raison sociale", "societe", "société", "client", "klant", "kunde", "firma"] },
  { key: "kind", label: "Type (particulier / assujetti)", type: "enum", values: ["particulier", "assujetti", "franchise", "public", "etranger"], synonyms: ["type", "soort", "categorie"] },
  { key: "vatNumber", label: "N° TVA", type: "text", synonyms: ["tva", "btw", "vat", "n° tva", "btw-nummer", "ust-idnr", "numero tva"] },
  { key: "bce", label: "N° d'entreprise (BCE)", type: "text", synonyms: ["bce", "kbo", "ondernemingsnummer", "numéro d'entreprise", "enterprise number"] },
  { key: "email", label: "E-mail", type: "text", synonyms: ["email", "e-mail", "mail", "courriel"] },
  { key: "phone", label: "Téléphone", type: "text", synonyms: ["telephone", "téléphone", "tel", "gsm", "phone", "telefoon", "mobile"] },
  { key: "street", label: "Rue et numéro", type: "text", synonyms: ["adresse", "rue", "address", "straat", "adres", "strasse", "straße"] },
  { key: "postcode", label: "Code postal", type: "text", synonyms: ["code postal", "cp", "postcode", "postal code", "plz"] },
  { key: "city", label: "Localité", type: "text", synonyms: ["ville", "localite", "localité", "commune", "gemeente", "stad", "ort", "city"] },
  { key: "lang", label: "Langue (fr/nl/de)", type: "enum", values: ["fr", "nl", "de"], synonyms: ["langue", "taal", "sprache", "language"] },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Association automatique en-tête → champ (égalité puis inclusion des synonymes). */
export function autoMap(headers: string[], fields: FieldDef[], remembered?: Record<string, string> | null): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  headers.forEach((h) => {
    if (remembered?.[h] && fields.some((f) => f.key === remembered[h])) {
      map[h] = remembered[h];
      used.add(remembered[h]);
    }
  });
  for (const pass of ["exact", "contains"] as const)
    headers.forEach((h) => {
      if (map[h]) return;
      const nh = norm(h);
      const f = fields.find((f) => !used.has(f.key) && [f.label, ...f.synonyms].map(norm).some((s) => (pass === "exact" ? s === nh : s.length > 2 && (nh.includes(s) || s.includes(nh)))));
      if (f) {
        map[h] = f.key;
        used.add(f.key);
      }
    });
  return map;
}

// ——— Validation ————————————————————————————————————————————————————————————

export type RowError = { row: number; field: string; message: string };
export type Parsed = { row: number; values: Record<string, string | number> };

export function validateRows(table: Table, mapping: Record<string, string>, fields: FieldDef[]): { parsed: Parsed[]; errors: RowError[] } {
  const parsed: Parsed[] = [];
  const errors: RowError[] = [];
  const colOf = (key: string) => table.headers.findIndex((h) => mapping[h] === key);
  table.rows.forEach((cells, i) => {
    const row = i + 2; // ligne Excel (1 = en-têtes)
    const values: Record<string, string | number> = {};
    let ok = true;
    for (const f of fields) {
      const c = colOf(f.key);
      const raw = c >= 0 ? (cells[c] ?? "").trim() : "";
      if (!raw) {
        if (f.required) {
          errors.push({ row, field: f.label, message: "Valeur obligatoire manquante" });
          ok = false;
        }
        continue;
      }
      if (f.type === "number") {
        const n = parseNumber(raw);
        if (n === null || n < 0) {
          errors.push({ row, field: f.label, message: `Nombre invalide : « ${raw} »` });
          ok = false;
        } else values[f.key] = n;
      } else values[f.key] = raw;
    }
    if (ok) parsed.push({ row, values });
  });
  return { parsed, errors };
}

export const errorReportCsv = (errors: RowError[]) =>
  "﻿" + ["Ligne;Champ;Problème", ...errors.map((e) => [e.row, e.field, e.message].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))].join("\r\n");

// ——— Articles ——————————————————————————————————————————————————————————————

const TYPE_MAP: Record<string, ArticleType> = { fourniture: "supply", "main-d'oeuvre": "labour", mo: "labour", location: "equipment", "sous-traitance": "subcontract", forfait: "package" };
const UNIT_MAP: Record<string, string> = { m2: "m²", "m²": "m²", m3: "m³", "m³": "m³", ml: "ml", lm: "ml", m: "ml", st: "u", stuk: "u", stk: "u", pc: "u", pce: "u", piece: "u", pièce: "u", u: "u", h: "h", uur: "h", heure: "h", std: "h", j: "j", jour: "j", dag: "j", kg: "kg", l: "L", litre: "L", forfait: "forfait", ff: "forfait", lot: "lot", set: "lot" };

export const normalizeUnit = (u: string) => UNIT_MAP[norm(u).replace(/\s/g, "")] ?? (u.trim() || "u");

function categoryFor(type: ArticleType, vatHint?: string): LineCategory {
  const v = norm(vatHint ?? "");
  if (v.includes("fourniture")) return "supply_only";
  if (type === "labour" || v.includes("main")) return "labour";
  return "installed_material";
}

export type DuplicateMode = "update" | "skip" | "create";
export type ImportPlan = { create: Article[]; update: Article[]; skipped: number; errors: RowError[] };

/** Simulation : aucun changement n'est appliqué tant que le plan n'est pas confirmé. */
export function planArticleImport(parsed: Parsed[], existing: Article[], opts: { duplicates: DuplicateMode; supplierId: string | null; defaultMargin: number; trade: Article["trade"] }): ImportPlan {
  const byRef = new Map(existing.filter((a) => a.ref).map((a) => [a.ref.toLowerCase(), a]));
  const create: Article[] = [];
  const update: Article[] = [];
  let skipped = 0;
  for (const { values } of parsed) {
    const ref = String(values.ref ?? "").trim();
    const type = TYPE_MAP[norm(String(values.type ?? ""))] ?? "supply";
    const purchase = typeof values.purchasePrice === "number" ? values.purchasePrice : null;
    const sale = typeof values.salePrice === "number" ? values.salePrice : null;
    const margin = typeof values.marginPercent === "number" ? values.marginPercent : opts.defaultMargin;
    const fields: Partial<Article> = {
      ref,
      name: { fr: String(values.name_fr), nl: String(values.name_nl ?? ""), de: String(values.name_de ?? "") },
      family: String(values.family ?? ""),
      unit: normalizeUnit(String(values.unit ?? "u")),
      type,
      category: categoryFor(type, String(values.vat ?? "")),
      supplierRef: String(values.supplierRef ?? ""),
      ean: String(values.ean ?? ""),
      supplierId: opts.supplierId,
      trade: opts.trade,
      marginPercent: margin,
      purchasePrice: purchase ?? (sale !== null ? round2(sale / (1 + margin / 100)) : 0),
      salePrice: sale ?? 0,
      salePriceForced: sale !== null && purchase === null,
    };
    const dup = ref ? byRef.get(ref.toLowerCase()) : undefined;
    if (dup && opts.duplicates === "skip") skipped++;
    else if (dup && opts.duplicates === "update") {
      // mise à jour tarifaire : on garde la marge de l'article si le fichier n'en donne pas
      const next: Article = {
        ...dup,
        ...Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== "" && v !== null && !(k === "name" && !(v as Article["name"]).fr))),
        name: { fr: fields.name!.fr || dup.name.fr, nl: fields.name!.nl || dup.name.nl, de: fields.name!.de || dup.name.de },
        marginPercent: typeof values.marginPercent === "number" ? margin : dup.marginPercent,
        salePriceForced: sale !== null && purchase === null ? true : purchase !== null ? false : dup.salePriceForced,
        priceHistory: [...dup.priceHistory, { at: todayIso(), purchase: dup.purchasePrice, sale: dup.salePrice }],
      } as Article;
      update.push(next);
    } else create.push(newArticle(fields));
  }
  return { create, update, skipped, errors: [] };
}

export function applyArticlePlan(existing: Article[], plan: ImportPlan) {
  const upd = new Map(plan.update.map((a) => [a.id, a]));
  return recalcAll([...existing.map((a) => upd.get(a.id) ?? a), ...plan.create]);
}

// ——— Clients ———————————————————————————————————————————————————————————————

const KIND_MAP: Record<string, ClientKind> = { particulier: "particulier", prive: "particulier", particulieren: "particulier", assujetti: "assujetti", professionnel: "assujetti", pro: "assujetti", entreprise: "assujetti", bedrijf: "assujetti", franchise: "franchise", public: "public", etranger: "etranger" };

export function clientsFromParsed(parsed: Parsed[], existing: Client[], duplicates: DuplicateMode) {
  const byKey = new Map(existing.map((c) => [(c.vatNumber || c.email || c.name).toLowerCase(), c]));
  const create: Client[] = [];
  const update: Client[] = [];
  let skipped = 0;
  for (const { values: v } of parsed) {
    const vat = String(v.vatNumber ?? "").replace(/[\s.]/g, "").toUpperCase();
    const kind = KIND_MAP[norm(String(v.kind ?? ""))] ?? (vat ? "assujetti" : "particulier");
    const lang = (["fr", "nl", "de"].includes(String(v.lang ?? "").toLowerCase()) ? String(v.lang).toLowerCase() : "fr") as Lang;
    const fields: Partial<Client> = {
      name: String(v.name),
      kind,
      vatNumber: vat,
      bce: String(v.bce ?? (vat.startsWith("BE") ? vat.slice(2) : "")),
      email: String(v.email ?? ""),
      phone: String(v.phone ?? ""),
      lang,
      billing: { street: String(v.street ?? ""), postcode: String(v.postcode ?? ""), city: String(v.city ?? ""), country: "BE" },
    };
    const dup = byKey.get((vat || String(v.email ?? "") || String(v.name)).toLowerCase());
    if (dup && duplicates === "skip") skipped++;
    else if (dup && duplicates === "update") update.push({ ...dup, ...fields, billing: { ...dup.billing, ...Object.fromEntries(Object.entries(fields.billing!).filter(([, x]) => x)) } });
    else create.push(newClient(fields));
  }
  return { create, update, skipped };
}

// ——— Modèles et exports ————————————————————————————————————————————————————

export async function workbookBlob(sheets: { name: string; headers: string[]; rows: (string | number)[][]; notes?: string[] }[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Biltov";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.addRow(s.headers).font = { bold: true };
    s.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 22));
    if (s.notes?.length) {
      const help = wb.addWorksheet("Mode d'emploi");
      s.notes.forEach((n) => help.addRow([n]));
      help.getColumn(1).width = 110;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export const articleTemplate = () =>
  workbookBlob([
    {
      name: "Articles",
      headers: ARTICLE_FIELDS.map((f) => f.label),
      rows: [
        ["CAR-3060", "Carrelage sol 60×60 grès cérame", "Vloertegel 60×60 keramiek", "Bodenfliese 60×60 Feinsteinzeug", "Carrelage", "m²", "24,50", "35", "", "fourniture", "FAC-123456", "5412345678901", "pose"],
        ["MO-CAR", "Main-d'œuvre carreleur", "Arbeidsloon tegelzetter", "Arbeitszeit Fliesenleger", "Main-d'œuvre", "h", "32", "60", "", "main-d'oeuvre", "", "", "main-d'oeuvre"],
        ["COL-C2", "Colle carrelage C2 25 kg", "Tegellijm C2 25 kg", "Fliesenkleber C2 25 kg", "Carrelage", "u", "18,90", "", "29,00", "fourniture", "", "", "fourniture seule"],
      ],
      notes: [
        "Une ligne par article. Seule la colonne « Désignation FR » est obligatoire.",
        "Montants HTVA : virgule ou point acceptés, symbole € facultatif (ex. 1.234,56 €).",
        "Prix : indiquez le prix d'achat et la marge %, OU directement le prix de vente (il sera alors fixé).",
        "Unités : u, m², m³, ml, h, j, kg, L, forfait, lot.",
        "Type : fourniture, main-d'oeuvre, location, sous-traitance, forfait.",
        "Catégorie TVA : « pose » (matériau posé), « fourniture seule » (toujours 21 %), « main-d'oeuvre ».",
        "Une référence déjà présente peut être mise à jour, ignorée ou dupliquée (choix lors de l'import).",
      ],
    },
  ]);
