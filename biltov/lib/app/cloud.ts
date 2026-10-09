// Enregistrement en ligne (Supabase) de l'espace artisan.
// L'appareil reste la source immédiate (IndexedDB, fonctionne hors ligne) ; chaque modification est
// marquée « à envoyer » puis poussée vers Supabase : table account_data (une ligne par collection)
// et bucket privé « biltov » pour les fichiers. La liste des envois en attente est conservée sur
// l'appareil : rien n'est perdu si l'onglet se ferme ou si la connexion tombe.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../utils/supabase/client";

const TABLE = "account_data";
const BUCKET = "biltov";
const RETRY_MS = 30_000;

/** Chemin d'un fichier dans le bucket : « <compte>/photo/<id> » (le premier dossier sert aux règles RLS). */
export const blobPath = (userId: string, key: string) => `${userId}/${key.replace(/:/g, "/")}`;

/** Toutes les collections du compte enregistrées en ligne (objet vide : rien encore). */
export async function cloudLoad(userId: string, sb: SupabaseClient = createClient()): Promise<Record<string, unknown>> {
  const { data, error } = await sb.from(TABLE).select("key, value").eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).filter((r) => r.value !== null).map((r) => [r.key as string, r.value]));
}

export async function cloudGetBlob(userId: string, key: string, sb: SupabaseClient = createClient()): Promise<Blob | undefined> {
  const { data, error } = await sb.storage.from(BUCKET).download(blobPath(userId, key));
  return error ? undefined : data;
}

type Source = {
  /** Valeur actuelle d'une collection (cache local) */
  value: (key: string) => Promise<unknown>;
  /** Fichier stocké sur l'appareil */
  blob: (key: string) => Promise<Blob | undefined>;
};

/** File d'envoi vers Supabase pour un compte. */
export class CloudSync {
  private dirty = new Map<string, number>(); // « data:<collection> » ou « blob:<clé> » → génération
  private gen = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private storageKey: string;

  constructor(
    private userId: string,
    private source: Source,
    private sb: SupabaseClient = createClient(),
  ) {
    this.storageKey = `biltov.pending.${userId}`;
    for (const name of this.readPending()) this.dirty.set(name, ++this.gen);
  }

  /** Collections modifiées sur l'appareil et pas encore enregistrées en ligne. */
  pendingData() {
    return [...this.dirty.keys()].filter((n) => n.startsWith("data:")).map((n) => n.slice(5));
  }

  get pending() {
    return this.dirty.size;
  }

  markData(keys: string[]) {
    for (const key of keys) this.dirty.set(`data:${key}`, ++this.gen);
    this.persist();
    this.schedule();
  }

  markBlob(key: string) {
    this.dirty.set(`blob:${key}`, ++this.gen);
    this.persist();
    this.schedule();
  }

  schedule(delay = 1500) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async flush(): Promise<boolean> {
    if (this.flushing) {
      this.schedule();
      return false;
    }
    if (!this.dirty.size) return true;
    this.flushing = true;
    const batch = [...this.dirty];
    let ok = true;
    try {
      const data = batch.filter(([n]) => n.startsWith("data:"));
      if (data.length) {
        const now = new Date().toISOString();
        const rows = await Promise.all(data.map(async ([n]) => ({ user_id: this.userId, key: n.slice(5), value: (await this.source.value(n.slice(5))) ?? null, updated_at: now })));
        const { error } = await this.sb.from(TABLE).upsert(rows);
        if (error) throw error;
        this.done(data);
      }
      for (const entry of batch.filter(([n]) => n.startsWith("blob:"))) {
        const key = entry[0].slice(5);
        const blob = await this.source.blob(key);
        if (blob) {
          const { error } = await this.sb.storage.from(BUCKET).upload(blobPath(this.userId, key), blob, { upsert: true, contentType: blob.type || undefined });
          if (error) throw error;
        }
        this.done([entry]);
      }
    } catch {
      ok = false;
    } finally {
      this.flushing = false;
    }
    if (this.dirty.size) this.schedule(ok ? 0 : RETRY_MS);
    return ok;
  }

  /** Retire les envois réussis, sauf ceux modifiés à nouveau pendant l'envoi. */
  private done(entries: [string, number][]) {
    for (const [n, g] of entries) if (this.dirty.get(n) === g) this.dirty.delete(n);
    this.persist();
  }

  private readPending(): string[] {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) ?? "[]");
    } catch {
      return [];
    }
  }

  private persist() {
    try {
      if (this.dirty.size) localStorage.setItem(this.storageKey, JSON.stringify([...this.dirty.keys()]));
      else localStorage.removeItem(this.storageKey);
    } catch {}
  }
}
