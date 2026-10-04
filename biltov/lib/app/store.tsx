"use client";

// État de l'espace artisan. Chaque collection est enregistrée séparément dans IndexedDB
// (clé « v2:<compte>:<collection> ») : seules les collections modifiées sont réécrites.
// Couche d'accès unique : pourra être remplacée par une base serveur (Supabase) sans toucher l'UI.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { idbDel, idbGet, idbSet } from "./db";
import { currentAccount, setSession } from "./auth";
import { DEMO_ID, buildDemoData } from "./demo";
import { emptyAccountData, uid } from "./defaults";
import { PermissionError, allows, deniedWrites, migrateRoles, permissionsOf, type Denied } from "./permissions";
import type { Access, Account, AccountData, CollectionKey, Geo, Member, PermModule, Permissions, PhotoPhase, Photo } from "./types";

type Ctx = {
  account: Account | null;
  data: AccountData | null;
  loading: boolean;
  isDemo: boolean;
  signedIn: (a: Account) => Promise<void>;
  logOut: () => void;
  resetDemo: () => Promise<void>;
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

async function loadAll(accId: string): Promise<AccountData | null> {
  const parts = await Promise.all(KEYS.map((key) => idbGet(k(accId, key))));
  if (parts.every((p) => p === undefined)) return null;
  const base = emptyAccountData("");
  const out = { ...base } as Record<string, unknown>;
  KEYS.forEach((key, i) => {
    const v = parts[i];
    if (v === undefined) return;
    // fusion des objets simples avec les valeurs par défaut (nouveaux champs)
    out[key] = v && typeof v === "object" && !Array.isArray(v) ? { ...(base[key] as object), ...(v as object) } : v;
  });
  return out as AccountData;
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
      commit(next);
    },
    [commit],
  );

  // Une écriture refusée interrompt l'action en cours : l'erreur est attendue et déjà signalée.
  useEffect(() => {
    const swallow = (e: ErrorEvent | PromiseRejectionEvent) => {
      const err = "reason" in e ? e.reason : e.error;
      if (err instanceof PermissionError) e.preventDefault();
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
      let stored = await loadAll(a.id);
      if (!stored) {
        stored = a.id === DEMO_ID ? await buildDemoData() : { ...emptyAccountData(a.email) };
        await saveAll(a.id, stored);
      }
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

  // Sauvegarde différentielle
  useEffect(() => {
    if (!account || !data) return;
    const id = setTimeout(() => {
      const prev = saved.current;
      for (const key of KEYS) if (!prev || prev[key] !== data[key]) void idbSet(k(account.id, key), data[key]);
      saved.current = data;
    }, 250);
    return () => clearTimeout(id);
  }, [account, data]);

  const perms = useMemo(() => permissionsOf(data?.settings ?? {}, actor), [data?.settings, actor]);

  const ctx = useMemo<Ctx>(() => {
    const cur = () => ref.current!;
    return {
      account,
      data,
      loading,
      isDemo: account?.id === DEMO_ID,
      signedIn: load,
      logOut: () => {
        setSession(null);
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
      },
      getBlob: (key) => idbGet<Blob>(`blob:${key}`),
      blobUrl: async (key) => {
        const cache = urlCache.current;
        if (cache.has(key)) return cache.get(key)!;
        const blob = await idbGet<Blob>(`blob:${key}`);
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
    };
  }, [account, data, loading, load, commit, write, actor, perms, denied]);

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
