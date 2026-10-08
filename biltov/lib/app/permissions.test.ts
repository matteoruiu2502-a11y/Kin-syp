import { describe, expect, it } from "vitest";
import { emptyAccountData, newClient, newDoc, newJob } from "./defaults";
import { DEFAULT_PERMISSIONS, deniedWrites, migrateRoles, permissionsOf, rolePermissions, workerOnly } from "./permissions";
import type { AccountData, Member, Role } from "./types";
import { newWeatherDay } from "./weather";

const member = (id: string, role: Role, extra: Partial<Member> = {}): Member => ({ id, name: id, role, phone: "", email: "", lang: "fr", hourlyCost: 30, color: "", pin: "1234", active: true, ...extra });

const base = (): AccountData => {
  const d = emptyAccountData("a@b.be");
  const job = newJob({ id: "j", clientId: "c" });
  return {
    ...d,
    clients: [newClient({ id: "c" })],
    jobs: [job],
    docs: [{ ...newDoc({ jobId: "j", clientId: "c", type: "quote" }), id: "q" }, { ...newDoc({ jobId: "j", clientId: "c", type: "invoice" }), id: "i" }],
    members: [member("boss", "owner"), member("w", "worker"), member("acc", "accountant"), member("sec", "secretary"), member("adm", "admin")],
  };
};
const who = (d: AccountData, id: string) => d.members.find((m) => m.id === id)!;

describe("droits d'accès", () => {
  it("super admin : tous les droits", () => {
    const d = base();
    expect(deniedWrites(d, { ...d, settings: { ...d.settings, rolePermissions: { worker: { bank: "edit" } } } }, null)).toEqual([]);
    expect(deniedWrites(d, { ...d, members: d.members.filter((m) => m.id !== "w") }, who(d, "boss"))).toEqual([]);
  });

  it("droits par défaut cohérents par rôle", () => {
    const d = base();
    expect(workerOnly(permissionsOf(d.settings, who(d, "w")))).toBe(true);
    const acc = permissionsOf(d.settings, who(d, "acc"));
    expect(acc.accounting).toBe("edit");
    expect(acc.quotes).toBe("read");
    expect(acc.catalog).toBe("none");
    // la rentabilité n'est jamais « modifiable »
    expect(permissionsOf(d.settings, who(d, "adm")).profit).toBe("read");
  });

  it("refuse une modification sans droit (devis en lecture seule pour le comptable)", () => {
    const d = base();
    const next = { ...d, docs: d.docs.map((x) => (x.id === "q" ? { ...x, notes: "modifié" } : x)) };
    expect(deniedWrites(d, next, who(d, "acc"))).toEqual(["quotes"]);
    expect(deniedWrites(d, next, who(d, "sec"))).toEqual([]);
    // facture : autorisée pour le comptable
    const inv = { ...d, docs: d.docs.map((x) => (x.id === "i" ? { ...x, notes: "x" } : x)) };
    expect(deniedWrites(d, inv, who(d, "acc"))).toEqual([]);
  });

  it("droits du rôle modifiés par le super admin, puis exceptions par personne", () => {
    let d = base();
    d = { ...d, settings: { ...d.settings, rolePermissions: { accountant: { quotes: "edit" } } } };
    expect(rolePermissions(d.settings, "accountant").quotes).toBe("edit");
    const next = { ...d, docs: d.docs.map((x) => (x.id === "q" ? { ...x, notes: "ok" } : x)) };
    expect(deniedWrites(d, next, who(d, "acc"))).toEqual([]);
    d = { ...d, members: d.members.map((m) => (m.id === "acc" ? { ...m, permissions: { quotes: "read" } } : m)) };
    expect(deniedWrites(d, { ...next, members: d.members }, who(d, "acc"))).toEqual(["quotes"]);
  });

  it("utilisateurs et accès : réservés au super admin", () => {
    const d = base();
    const adm = who(d, "adm");
    expect(deniedWrites(d, { ...d, members: [...d.members, member("new", "worker")] }, adm)).toEqual(["users"]);
    expect(deniedWrites(d, { ...d, members: d.members.map((m) => (m.id === "w" ? { ...m, role: "admin" as const } : m)) }, adm)).toEqual(["users"]);
    expect(deniedWrites(d, { ...d, members: d.members.map((m) => (m.id === "adm" ? { ...m, permissions: { bank: "edit" as const } } : m)) }, adm)).toEqual(["users"]);
    expect(deniedWrites(d, { ...d, settings: { ...d.settings, rolePermissions: { admin: {} } } }, adm)).toEqual(["users"]);
    // autres champs : droit « Employés »
    expect(deniedWrites(d, { ...d, members: d.members.map((m) => (m.id === "w" ? { ...m, phone: "0470" } : m)) }, adm)).toEqual([]);
  });

  it("l'ouvrier ne modifie que ses propres données", () => {
    const d = base();
    const w = who(d, "w");
    const own = { id: "t1", memberId: "w", jobId: "j", date: "2026-10-01", start: "08:00", end: "12:00", hours: 4, note: "" };
    expect(deniedWrites(d, { ...d, timeEntries: [own] }, w)).toEqual([]);
    expect(deniedWrites(d, { ...d, timeEntries: [{ ...own, id: "t2", memberId: "sec" }] }, w)).toEqual(["time"]);
    expect(deniedWrites(d, { ...d, clients: [...d.clients, newClient({ id: "c2" })] }, w)).toEqual(["clients"]);
    const leave = { id: "e", kind: "leave" as const, title: "Congé", jobId: null, clientId: null, memberIds: ["w"], start: "2026-10-10T00:00", end: "2026-10-11T23:59", notes: "", status: "requested" as const };
    expect(deniedWrites(d, { ...d, events: [leave] }, w)).toEqual([]);
    // il ne valide pas son propre congé
    expect(deniedWrites({ ...d, events: [leave] }, { ...d, events: [{ ...leave, status: "approved" }] }, w)).toEqual(["planning"]);
  });

  it("le montant du chantier suit le devis", () => {
    let d = base();
    d = { ...d, settings: { ...d.settings, rolePermissions: { secretary: { jobs: "read" } } } };
    const next = { ...d, jobs: d.jobs.map((j) => ({ ...j, amount: 1234 })), docs: d.docs.map((x) => (x.id === "q" ? { ...x, notes: "n" } : x)) };
    expect(deniedWrites(d, next, who(d, "sec"))).toEqual([]);
    expect(deniedWrites(d, { ...d, jobs: d.jobs.map((j) => ({ ...j, name: "autre" })) }, who(d, "sec"))).toEqual(["jobs"]);
  });

  it("utilisateur supprimé ou inactif : aucun droit", () => {
    const d = base();
    const ghost = member("x", "worker", { active: false, permissions: { worker: "none" } });
    expect(deniedWrites(d, { ...d, clients: [] }, ghost)).toEqual(["clients"]);
  });

  it("ancien rôle « Secrétariat » migré", () => {
    const d = base();
    const old = { ...d, members: [{ ...member("o", "secretary"), role: "office" as unknown as Role }] };
    expect(migrateRoles(old).members[0].role).toBe("secretary");
    expect(Object.keys(DEFAULT_PERMISSIONS)).toHaveLength(5);
  });

  it("intempéries : l'ouvrier déclare les siennes, seul un administrateur valide", () => {
    const d = base();
    const mine = newWeatherDay({ id: "w1", start: "2026-10-06", createdBy: "w", createdById: "w", jobIds: ["j"] });
    const add = { ...d, weatherDays: [mine] };
    expect(deniedWrites(d, add, who(d, "w"))).toEqual([]);
    // modifier l'intempérie d'un autre : non
    const other = { ...d, weatherDays: [{ ...mine, createdById: "boss" }] };
    expect(deniedWrites(other, { ...other, weatherDays: [{ ...other.weatherDays[0], comment: "x" }] }, who(d, "w"))).toEqual(["planning"]);
    // valider : l'administrateur oui, la secrétaire (droit planning) et l'ouvrier non
    const validate = { ...add, weatherDays: [{ ...mine, status: "validated" as const }] };
    expect(deniedWrites(add, validate, who(d, "adm"))).toEqual([]);
    expect(deniedWrites(add, validate, who(d, "sec"))).toEqual(["planning"]);
    expect(deniedWrites(add, validate, who(d, "w"))).toEqual(["planning"]);
    // une intempérie validée ne peut plus être modifiée par l'ouvrier
    expect(deniedWrites(validate, { ...validate, weatherDays: [{ ...validate.weatherDays[0], comment: "x" }] }, who(d, "w"))).toEqual(["planning"]);
    // le comptable lit le planning (exports) sans le modifier
    expect(permissionsOf(d.settings, who(d, "acc")).planning).toBe("read");
  });
});
