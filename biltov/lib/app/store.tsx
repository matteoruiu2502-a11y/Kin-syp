"use client";

// État de l'espace artisan. Chaque collection est enregistrée séparément dans IndexedDB
// (clé « v2:<compte>:<collection> ») : seules les collections modifiées sont réécrites.
// Compte en ligne (Supabase) : IndexedDB sert de copie locale (hors ligne) et chaque modification
// est aussi envoyée à Supabase (voir cloud.ts).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { idbDel, idbGet, idbKeys, idbSet } from "./db";
import { AuthError, currentAccount, localAccountFor, signOut } from "./auth";
import { CloudSync, cloudGetBlob, cloudLoad } from "./cloud";
import { DEMO_ID, buildDemoData } from "./demo";
import { emptyAccountData, uid } from "./defaults";
import { PermissionError, allows, deniedWrites, isSuperAdmin, migrateRoles, permissionsOf, type Denied } from "./permissions";
import type { Access, Account, AccountData, CollectionKey, Geo, Member, PermModule, Permissions, PhotoPhase, Photo } from "./types";
import type { Feature } from "../plans";
import { canAccess, capPermissions, effectiveStatus, entitlementOf, trialSubscription, usedInPeriod, type Entitlement, type Subscription, type Usage } from "../billing/entitlement";
import { OFFLINE_GRACE_DAYS, verifyLicense, type LicensePayload } from "../billing/license";
import { BILLING_PUBLIC_KEY, billingApi, billingConfigured, type Creds } from "../billing/client";
import { planBlock as checkPlan, type PlanBlock } from "../billing/guard";

/** Écriture refusée par le forfait (module non inclus, limite d'utilisateurs, lecture seule). */
export class PlanError extends Error {
  constructor(public block: PlanBlock) {
    super(`plan:${block.kind}`);
    this.name = "PlanError";
  }
}

/** Abonnement de l'entreprise tel que l'application le connaît. */
export type BillingInfo = {
  /** server : licence signée vérifiée ; local : essai calculé sur l'appareil (serveur pas encore joint) ;
   *  unconfigured : paiement pas encore branché (accès ouvert) ; demo : démonstration */
  source: "server" | "local" | "unconfigured" | "demo";
  sub: Subscription;
  usage: Usage | null;
  used: number;
  /** licence trop ancienne (appareil hors ligne trop longtemps) */
  offline: boolean;
  creds: Creds | null;
  refresh: () => Promise<void>;
  applyLicense: (token: string) => Promise<void>;
};

type Ctx = {
  account: Account | null;
  data: AccountData | null;
  loading: boolean;
  isDemo: boolean;
  signedIn: (a: Account) => Promise<void>;
  logOut: () => void;
  resetDemo: () => Promise<void>;
  /** Restauration d'une sauvegarde complète (super admin) : remplace les données sans contrôle de module ;
   *  l'abonnement de la sauvegarde est repris s'il existe (changement d'appareil). */
  restoreAll: (next: AccountData) => void;
  /** Applique une opération pure et renvoie son résultat. */
  run: <R>(op: (d: AccountData) => [AccountData, R]) => R;
  update: (fn: (d: AccountData) => AccountData) => void;
  upsert: <K extends CollectionKey>(key: K, item: AccountData[K][number]) => void;
  remove: (key: CollectionKey, id: string) => void;
  putBlob: (key: string, blob: Blob) => Promise<void>;
  blobUrl: (key: string) => Promise<string | null>;
  getBlob: (key: string) => Promise<Blob | undefined>;
  addPhotos: (jobId: string, phase: PhotoPhase, files: File[], geo?: Geo | null) => Promise<void>;
  /** Utilisateur actif sur l'appareil (null = super admin, titulaire du compte). */
  actor: Member | null;
  setActor: (memberId: string | null) => void;
  perms: Permissions;
  can: (m: PermModule, need?: Access) => boolean;
  /** Dernière écriture refusée faute de droits. */
  denied: Denied[] | null;
  clearDenied: () => void;
  /** Forfait : droits de l'entreprise, abonnement, accès aux fonctionnalités. */
  ent: Entitlement;
  billing: BillingInfo;
  feature: (f: Feature) => boolean;
  /** Droits du rôle seuls (sans le forfait) : sert à afficher un module grisé « Disponible dans le forfait X ». */
  rolePerms: Permissions;
  canRole: (m: PermModule, need?: Access) => boolean;
  planBlock: PlanBlock | null;
  showPlanBlock: (b: PlanBlock) => void;
  clearPlanBlock: () => void;
};

const AppContext = createContext<Ctx | null>(null);
const KEYS = Object.keys(emptyAccountData("")) as (keyof AccountData)[];
const k = (acc: string, key: string) => `v2:${acc}:${key}`;
const actorKey = (acc: string) => `biltov.actor.${acc}`;

function readActor(acc: string) {
  try {
    return localStorage.getItem(actorKey(acc));
  } catch {
    return null;
  }
}

/** Réduit une image (max 2000 px, JPEG) pour un stockage léger et des PDF rapides. */
export async function compressImage(file: Blob, max = 2000, quality = 0.85): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", quality));
  return { blob, width, height };
}

/** Assemble les collections enregistrées (null : aucune). */
function fromParts(parts: Partial<Record<keyof AccountData, unknown>>): AccountData | null {
  if (KEYS.every((key) => parts[key] === undefined || parts[key] === null)) return null;
  const base = emptyAccountData("");
  const out = { ...base } as Record<string, unknown>;
  KEYS.forEach((key) => {
    const v = parts[key];
    if (v === undefined || v === null) return;
    // fusion des objets simples avec les valeurs par défaut (nouveaux champs)
    out[key] = v && typeof v === "object" && !Array.isArray(v) ? { ...(base[key] as object), ...(v as object) } : v;
  });
  return out as AccountData;
}

async function loadAll(accId: string): Promise<AccountData | null> {
  const parts = await Promise.all(KEYS.map((key) => idbGet(k(accId, key))));
  return fromParts(Object.fromEntries(KEYS.map((key, i) => [key, parts[i]])));
}

/** Clés des fichiers de l'appareil utilisés par ces données (identifiants présents dans les collections). */
async function blobKeysOf(data: AccountData) {
  const text = JSON.stringify(data);
  return (await idbKeys("blob:")).map((key) => key.slice(5)).filter((key) => {
    const id = key.slice(key.lastIndexOf(":") + 1);
    return id.length >= 6 && text.includes(id);
  });
}

/**
 * Compte en ligne : données Supabase, sauf les collections modifiées sur l'appareil et pas encore envoyées.
 * Première connexion : reprise des données déjà présentes sur l'appareil (cache ou ancien compte local
 * du même e-mail), envoyées en ligne avec leurs fichiers. Hors ligne : copie locale.
 */
async function loadCloud(a: Account, sync: CloudSync): Promise<AccountData | null> {
  const local = await loadAll(a.id);
  let remote: Record<string, unknown>;
  try {
    remote = await cloudLoad(a.id);
  } catch {
    // hors ligne sans copie locale : ne jamais repartir d'un espace vide (il écraserait les données en ligne)
    if (!local) throw new AuthError("network");
    return local;
  }
  const pending = new Set(sync.pendingData());
  const parts = Object.fromEntries(KEYS.map((key) => [key, pending.has(key) && local ? local[key] : remote[key]]));
  const merged = fromParts(parts);
  if (merged) {
    await saveAll(a.id, merged);
    return merged;
  }
  const legacy = await localAccountFor(a.email);
  const imported = local ?? (legacy ? await loadAll(legacy.id) : null);
  if (!imported) return null;
  // l'abonnement reste celui de l'entreprise d'origine auprès du serveur
  if (legacy && !local) imported.billing = { ...imported.billing, accountId: imported.billing?.accountId || legacy.id };
  await saveAll(a.id, imported);
  sync.markData(KEYS);
  for (const key of await blobKeysOf(imported)) sync.markBlob(key);
  return imported;
}

async function saveAll(accId: string, data: AccountData) {
  await Promise.all(KEYS.map((key) => idbSet(k(accId, key), data[key])));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<AccountData | null>(null);
  const saved = useRef<AccountData | null>(null);
  const urlCache = useRef(new Map<string, string>());
  const [actorId, setActorId] = useState<string | null>(null);
  const actorRef = useRef<Member | null>(null);
  const [denied, setDenied] = useState<Denied[] | null>(null);
  const [planBlockState, setPlanBlockState] = useState<PlanBlock | null>(null);
  const syncRef = useRef<CloudSync | null>(null);
  const entRef = useRef<Entitlement>(entitlementOf(trialSubscription(new Date().toISOString())));
  // Utilisateur supprimé ou désactivé : aucun droit (jamais de retour silencieux au super admin).
  const actor = useMemo<Member | null>(() => {
    if (!actorId || !data) return null;
    const m = data.members.find((x) => x.id === actorId);
    return m && m.active ? m : { id: actorId, name: "", role: "worker", phone: "", email: "", lang: "fr", hourlyCost: 0, color: "#64748b", pin: "", active: false, permissions: { worker: "none" } };
  }, [actorId, data?.members]);
  actorRef.current = actor;

  const commit = useCallback((next: AccountData) => {
    ref.current = next;
    setData(next);
  }, []);

  /** Écriture contrôlée : refusée (et signalée) si l'utilisateur actif n'a pas le droit de modifier. */
  const write = useCallback(
    (next: AccountData) => {
      const prev = ref.current!;
      const missing = deniedWrites(prev, next, actorRef.current);
      if (missing.length) {
        setDenied(missing);
        throw new PermissionError(missing);
      }
      const block = checkPlan(prev, next, entRef.current);
      if (block) {
        setPlanBlockState(block);
        throw new PlanError(block);
      }
      commit(next);
    },
    [commit],
  );

  // Une écriture refusée interrompt l'action en cours : l'erreur est attendue et déjà signalée.
  useEffect(() => {
    const swallow = (e: ErrorEvent | PromiseRejectionEvent) => {
      const err = "reason" in e ? e.reason : e.error;
      if (err instanceof PermissionError || err instanceof PlanError) e.preventDefault();
    };
    window.addEventListener("error", swallow);
    window.addEventListener("unhandledrejection", swallow);
    return () => {
      window.removeEventListener("error", swallow);
      window.removeEventListener("unhandledrejection", swallow);
    };
  }, []);

  const load = useCallback(
    async (a: Account) => {
      syncRef.current?.stop();
      const sync = a.cloud ? new CloudSync(a.id, { value: (key) => idbGet(k(a.id, key)), blob: (key) => idbGet<Blob>(`blob:${key}`) }) : null;
      syncRef.current = sync;
      let stored = sync ? await loadCloud(a, sync) : await loadAll(a.id);
      if (!stored) {
        stored = a.id === DEMO_ID ? await buildDemoData() : { ...emptyAccountData(a.email) };
        await saveAll(a.id, stored);
        sync?.markData(KEYS);
      }
      void sync?.flush();
      stored = migrateRoles(stored);
      saved.current = stored;
      commit(stored);
      setActorId(readActor(a.id));
      setAccount(a);
    },
    [commit],
  );

  useEffect(() => {
    currentAccount()
      .then((a) => (a ? load(a) : undefined))
      .finally(() => setLoading(false));
  }, [load]);

  // Sauvegarde différentielle (puis envoi en ligne pour un compte Supabase)
  useEffect(() => {
    if (!account || !data) return;
    const id = setTimeout(() => {
      const prev = saved.current;
      const changed = KEYS.filter((key) => !prev || prev[key] !== data[key]);
      saved.current = data;
      if (!changed.length) return;
      const sync = syncRef.current;
      void Promise.all(changed.map((key) => idbSet(k(account.id, key), data[key]))).then(() => sync?.markData(changed));
    }, 250);
    return () => clearTimeout(id);
  }, [account, data]);

  // Retour de la connexion : envoi immédiat de ce qui attend
  useEffect(() => {
    const online = () => void syncRef.current?.flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);

  const rolePerms = useMemo(() => permissionsOf(data?.settings ?? {}, actor), [data?.settings, actor]);

  // ── Abonnement : licence signée par le serveur, ou essai local tant que le serveur n'est pas joint ──
  const [verified, setVerified] = useState<LicensePayload | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const token = data?.billing?.license ?? null;
  // identifiant de l'entreprise auprès du serveur (celui du compte d'origine après une restauration)
  const serverId = data?.billing?.accountId || account?.id || null;
  useEffect(() => {
    let alive = true;
    if (!token || !billingConfigured) setVerified(null);
    else verifyLicense(token, BILLING_PUBLIC_KEY).then((p) => alive && setVerified(p && p.acc === serverId ? p : null));
    return () => {
      alive = false;
    };
  }, [token, serverId]);

  const isDemo = account?.id === DEMO_ID;
  const billingBase = useMemo(() => {
    const created = account?.createdAt ?? new Date().toISOString();
    if (isDemo) {
      // démonstration : tout le forfait Max, sans limite de temps
      return { source: "demo" as const, sub: { ...trialSubscription(created), plan: "max" as const, status: "active" as const, cycle: "monthly" as const, periodStart: created }, usage: null, offline: false };
    }
    if (billingConfigured && verified) {
      const offline = tick > verified.exp + OFFLINE_GRACE_DAYS * 864e5;
      return { source: "server" as const, sub: verified.sub, usage: verified.usage, offline };
    }
    const trial = trialSubscription(created);
    // paiement pas encore branché : l'accès reste ouvert après l'essai (comme avant les forfaits)
    if (!billingConfigured && effectiveStatus(trial, tick) === "expired") return { source: "unconfigured" as const, sub: { ...trial, plan: "max" as const, status: "active" as const, cycle: "monthly" as const, periodStart: created }, usage: null, offline: false };
    return { source: "local" as const, sub: trial, usage: null, offline: false };
  }, [account?.createdAt, isDemo, verified, tick]);

  const ent = useMemo<Entitlement>(() => {
    // heure réelle du calcul (`tick` ne sert qu'à recalculer chaque minute)
    const e = entitlementOf(billingBase.sub, Math.max(tick, Date.now()));
    // hors ligne trop longtemps : lecture seule jusqu'à la prochaine vérification
    return billingBase.offline ? { ...e, readOnly: true } : e;
  }, [billingBase, tick]);
  entRef.current = ent;
  const perms = useMemo(() => capPermissions(rolePerms, ent), [rolePerms, ent]);

  /** Enregistre l'état d'abonnement sans passer par le contrôle des droits (il ne touche aucune donnée métier). */
  const setBilling = useCallback(
    (b: AccountData["billing"]) => {
      if (ref.current) commit({ ...ref.current, billing: b });
    },
    [commit],
  );
  const secret = data?.billing?.secret;
  const creds = useMemo(() => (account && serverId && secret && !isDemo ? { accountId: serverId, secret } : null), [account, serverId, secret, isDemo]);

  const refresh = useCallback(async () => {
    const d = ref.current;
    if (!billingConfigured || !account || !d || account.id === DEMO_ID || !d.company.bce) return;
    let secret = d.billing?.secret;
    const accountId = d.billing?.accountId || account.id;
    if (!secret) {
      secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      setBilling({ accountId, secret, license: null });
    }
    const c = { accountId, secret };
    try {
      const r = d.billing?.license ? await billingApi.license(c).catch((e) => (e.code === "unknown_account" ? billingApi.register(c, { email: account.email, bce: d.company.bce, createdAt: account.createdAt }) : Promise.reject(e))) : await billingApi.register(c, { email: account.email, bce: d.company.bce, createdAt: account.createdAt });
      setBilling({ accountId, secret, license: r.license });
    } catch {
      // hors ligne ou serveur indisponible : la dernière licence reste valable quelques jours
    }
  }, [account, setBilling]);

  const applyLicense = useCallback(
    async (license: string) => {
      const d = ref.current;
      if (d) setBilling({ ...d.billing, license });
    },
    [setBilling],
  );

  // vérification à l'ouverture, au retour du paiement et toutes les 6 heures
  const companyBce = data?.company.bce;
  useEffect(() => {
    if (!account || !companyBce) return;
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("abonnement")) {
        u.searchParams.delete("abonnement");
        window.history.replaceState(null, "", u.pathname + u.search + u.hash);
      }
    } catch {}
    void refresh();
    const id = setInterval(() => void refresh(), 6 * 3600_000);
    return () => clearInterval(id);
  }, [account, companyBce, refresh]);

  const ctx = useMemo<Ctx>(() => {
    const cur = () => ref.current!;
    /** Fichier de l'appareil, sinon téléchargé depuis Supabase (autre appareil) et gardé en copie locale. */
    const getBlob = async (key: string) => {
      const local = await idbGet<Blob>(`blob:${key}`);
      if (local || !account?.cloud) return local;
      const remote = await cloudGetBlob(account.id, key);
      if (remote) await idbSet(`blob:${key}`, remote);
      return remote;
    };
    return {
      account,
      data,
      loading,
      isDemo: account?.id === DEMO_ID,
      signedIn: load,
      logOut: () => {
        // les envois en attente restent notés sur l'appareil et partiront à la prochaine connexion
        void syncRef.current?.flush();
        syncRef.current?.stop();
        syncRef.current = null;
        void signOut();
        setActorId(null);
        setAccount(null);
        ref.current = null;
        setData(null);
      },
      resetDemo: async () => {
        const fresh = await buildDemoData();
        await saveAll(DEMO_ID, fresh);
        saved.current = fresh;
        commit(fresh);
      },
      run: (op) => {
        const [next, result] = op(cur());
        write(next);
        return result;
      },
      update: (fn) => write(fn(cur())),
      restoreAll: (next) => {
        const prev = cur();
        if (!isSuperAdmin(actorRef.current)) {
          setDenied(["users"]);
          throw new PermissionError(["users"]);
        }
        if (entRef.current.readOnly) {
          setPlanBlockState({ kind: "readonly" });
          throw new PlanError({ kind: "readonly" });
        }
        commit({ ...next, billing: next.billing?.secret && next.billing.accountId ? next.billing : prev.billing });
      },
      upsert: (key, item) => {
        const d = cur();
        const list = d[key] as { id: string }[];
        const next = list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
        write({ ...d, [key]: next });
      },
      remove: (key, id) => {
        const d = cur();
        write({ ...d, [key]: (d[key] as { id: string }[]).filter((x) => x.id !== id) });
      },
      putBlob: async (key, blob) => {
        await idbSet(`blob:${key}`, blob);
        urlCache.current.delete(key);
        syncRef.current?.markBlob(key);
      },
      getBlob,
      blobUrl: async (key) => {
        const cache = urlCache.current;
        if (cache.has(key)) return cache.get(key)!;
        const blob = await getBlob(key);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        cache.set(key, url);
        return url;
      },
      addPhotos: async (jobId, phase, files, geo = null) => {
        const p = permissionsOf(cur().settings, actorRef.current);
        if (!allows(p, "jobs", "edit") && !allows(p, "worker", "edit")) {
          setDenied(["jobs"]);
          throw new PermissionError(["jobs"]);
        }
        const added: Photo[] = [];
        for (const file of files) {
          const { blob, width, height } = await compressImage(file);
          const photo: Photo = { id: uid(), jobId, phase, caption: "", takenAt: new Date(file.lastModified || Date.now()).toISOString(), addedAt: new Date().toISOString(), width, height, geo };
          await idbSet(`blob:photo:${photo.id}`, blob);
          syncRef.current?.markBlob(`photo:${photo.id}`);
          added.push(photo);
        }
        const d = cur();
        write({ ...d, photos: [...d.photos, ...added] });
      },
      actor,
      setActor: (memberId) => {
        setActorId(memberId);
        try {
          if (!account) return;
          if (memberId) localStorage.setItem(actorKey(account.id), memberId);
          else localStorage.removeItem(actorKey(account.id));
        } catch {}
      },
      perms,
      can: (m, need = "read") => allows(perms, m, need),
      denied,
      clearDenied: () => setDenied(null),
      ent,
      billing: { ...billingBase, used: usedInPeriod(billingBase.usage, ent.period), creds, refresh, applyLicense },
      feature: (f) => canAccess(ent, f),
      rolePerms,
      canRole: (m, need = "read") => allows(rolePerms, m, need),
      planBlock: planBlockState,
      showPlanBlock: setPlanBlockState,
      clearPlanBlock: () => setPlanBlockState(null),
    };
  }, [account, data, loading, load, commit, write, actor, perms, denied, ent, billingBase, creds, refresh, applyLicense, rolePerms, planBlockState]);

  return <AppContext.Provider value={ctx}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Raccourci pour les écrans affichés une fois connecté. */
export function useAppData() {
  const app = useApp();
  return { ...app, data: app.data! };
}

export { idbDel };
