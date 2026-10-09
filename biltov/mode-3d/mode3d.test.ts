import { describe, expect, it } from "vitest";
import { emptyAccountData, newArticle, newJob } from "../lib/app/defaults";
import type { AccountData, Member, PermModule } from "../lib/app/types";
import { activeJobs, lowStockCount, officeBadge, parkingBadge, planningBadge, sceneFacts, stockBadge, timeBadge, type BadgeCtx } from "./badges";
import { ZONES, resolveZone, type PageAccess } from "./zones";

const TODAY = "2026-10-09";
const t = (s: string, v?: Record<string, string | number>) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => String(v[k])) : s);
const all = () => true;
const ctx = (data: AccountData, can: (m: PermModule) => boolean = all, me: Member | null = null): BadgeCtx => ({ data, can, me, today: TODAY, t });
const worker: Member = { id: "karim", name: "Karim", role: "worker", phone: "", email: "", lang: "fr", hourlyCost: 30, color: "", pin: "", active: true };

const filled = (): AccountData => {
  const d = emptyAccountData("");
  d.articles = [newArticle({ id: "colle", type: "supply", minStock: 10 }), newArticle({ id: "joint", type: "supply", minStock: 2 }), newArticle({ id: "vis", type: "supply", minStock: 0 })];
  d.stockMoves = [
    { id: "m1", articleId: "colle", locationId: "depot", qty: 8, date: TODAY, reason: "", jobId: null },
    { id: "m2", articleId: "joint", locationId: "depot", qty: 5, date: TODAY, reason: "", jobId: null },
  ];
  d.jobs = [
    newJob({ id: "a", clientId: "c", status: "in_progress", startDate: "2026-09-01", endDate: "2026-10-01" }),
    newJob({ id: "b", clientId: "c", status: "in_progress", startDate: "2026-10-01", endDate: "2026-10-30" }),
    newJob({ id: "q", clientId: "c", status: "sent" }),
  ];
  d.timeEntries = [
    { id: "t1", memberId: "karim", jobId: "a", date: TODAY, start: "07:30", end: "12:00", hours: 4.5, note: "" },
    { id: "t2", memberId: "piotr", jobId: "a", date: TODAY, start: "07:30", end: "12:00", hours: 4.5, note: "" },
    { id: "t3", memberId: "piotr", jobId: "a", date: "2026-10-08", start: "07:30", end: "12:00", hours: 4.5, note: "" },
  ];
  return d;
};

describe("mode 3D : badges calculés à partir des données réelles", () => {
  it("nouveau compte : état vide, compteurs à 0", () => {
    const f = sceneFacts(ctx(emptyAccountData("")));
    expect(f).toEqual({ lowStock: 0, workersIn: 0, lateJobs: 0, weatherToday: false, vans: 0, empty: true });
    expect(stockBadge(ctx(emptyAccountData("")))?.count).toBe(0);
    expect(timeBadge(ctx(emptyAccountData("")))?.text).toBe("0 personne pointée aujourd'hui");
  });

  it("stock bas, devis en attente, pointages du jour, retards et camionnettes", () => {
    const d = filled();
    expect(lowStockCount(d)).toBe(1); // colle 8/10 ; joint 5/2 et vis sans minimum ne comptent pas
    expect(stockBadge(ctx(d))).toMatchObject({ count: 1, tone: "danger", text: "1 article en stock bas" });
    expect(officeBadge(ctx(d))).toMatchObject({ count: 1, tone: "warning", text: "1 devis en attente · 0 facture impayée" });
    expect(timeBadge(ctx(d))).toMatchObject({ count: 2, tone: "ok", text: "2 personnes pointées aujourd'hui" });
    expect(planningBadge(ctx(d))).toMatchObject({ count: 1, tone: "danger", text: "1 chantier en retard" });
    expect(activeJobs(d)).toHaveLength(2);
    expect(parkingBadge(ctx(d))?.text).toBe("2 chantiers en cours");
    expect(sceneFacts(ctx(d))).toMatchObject({ lowStock: 1, workersIn: 2, lateJobs: 1, vans: 2, empty: false });
  });

  it("intempérie en cours : badge « attention » du planning", () => {
    const d = emptyAccountData("");
    d.weatherDays = [{ id: "w", start: "2026-10-08", end: "2026-10-10" } as AccountData["weatherDays"][number]];
    expect(planningBadge(ctx(d))).toMatchObject({ tone: "warning", text: "Aucun chantier en retard · Intempéries en cours" });
  });
});

describe("mode 3D : droits", () => {
  it("aucun compteur sans droit de lecture sur le module", () => {
    const d = filled();
    const none = () => false;
    expect([stockBadge, officeBadge, planningBadge, parkingBadge].map((f) => f(ctx(d, none)))).toEqual([null, null, null, null]);
    expect(sceneFacts(ctx(d, none))).toMatchObject({ lowStock: 0, workersIn: 0, lateJobs: 0, vans: 0 });
  });

  it("devis visibles mais pas les factures : seul le compteur autorisé apparaît", () => {
    const b = officeBadge(ctx(filled(), (m) => m === "quotes"));
    expect(b?.text).toBe("1 devis en attente");
  });

  it("un ouvrier ne voit que sa propre présence", () => {
    const b = timeBadge(ctx(filled(), (m) => m === "worker", worker));
    expect(b).toMatchObject({ count: 1, text: "Vous avez pointé aujourd'hui" });
  });

  it("une pièce s'ouvre sur la première page autorisée, sinon elle est verrouillée ou désactivée", () => {
    const zone = (id: string) => ZONES.find((z) => z.id === id)!;
    const access = (map: Record<string, PageAccess>) => (p: string) => map[p] ?? "locked";
    expect(resolveZone(zone("entrepot"), access({ stock: "ok", catalogue: "ok" }))).toEqual({ access: "ok", target: "stock" });
    expect(resolveZone(zone("entrepot"), access({ stock: "off", catalogue: "ok" }))).toEqual({ access: "ok", target: "catalogue" });
    expect(resolveZone(zone("entrepot"), access({ stock: "off", catalogue: "off" }))).toEqual({ access: "off", target: null });
    expect(resolveZone(zone("bureau"), access({}))).toEqual({ access: "locked", target: null });
    expect(resolveZone(zone("pointage"), access({ "mon-espace": "ok" }))).toEqual({ access: "ok", target: "mon-espace" });
    expect(resolveZone(zone("planning"), access({ planning: "ok" }))).toEqual({ access: "ok", target: "planning/gantt" });
    expect(resolveZone({ ...zone("parking"), soon: true }, access({ chantiers: "ok" }))).toEqual({ access: "soon", target: null });
  });
});
