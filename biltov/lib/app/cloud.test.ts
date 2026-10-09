import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CloudSync, blobPath } from "./cloud";

type Row = { user_id: string; key: string; value: unknown };

/** Faux client Supabase : enregistre les envois, peut simuler une panne. */
function fakeSb() {
  const state = { rows: [] as Row[], files: [] as string[], fail: false, onUpsert: null as null | (() => void) };
  const sb = {
    from: () => ({
      upsert: async (rows: Row[]) => {
        state.onUpsert?.();
        if (state.fail) return { error: new Error("offline") };
        state.rows.push(...rows);
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string) => {
          if (state.fail) return { error: new Error("offline") };
          state.files.push(path);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { sb, state };
}

const values: Record<string, unknown> = { clients: [{ id: "c1" }], jobs: [] };
const source = { value: async (key: string) => values[key], blob: async () => new Blob(["x"]) };

describe("envoi en ligne", () => {
  it("chemin des fichiers : dossier du compte en premier", () => {
    expect(blobPath("u1", "photo:abc")).toBe("u1/photo/abc");
  });

  it("envoie les collections et les fichiers marqués", async () => {
    const { sb, state } = fakeSb();
    const sync = new CloudSync("u1", source, sb);
    sync.markData(["clients", "jobs"]);
    sync.markBlob("photo:p1");
    sync.stop();
    expect(await sync.flush()).toBe(true);
    expect(state.rows.map((r) => [r.user_id, r.key, r.value])).toEqual([
      ["u1", "clients", [{ id: "c1" }]],
      ["u1", "jobs", []],
    ]);
    expect(state.files).toEqual(["u1/photo/p1"]);
    expect(sync.pending).toBe(0);
  });

  it("hors ligne : les envois restent en attente", async () => {
    const { sb, state } = fakeSb();
    state.fail = true;
    const sync = new CloudSync("u1", source, sb);
    sync.markData(["clients"]);
    expect(await sync.flush()).toBe(false);
    sync.stop();
    expect(sync.pendingData()).toEqual(["clients"]);
    state.fail = false;
    expect(await sync.flush()).toBe(true);
    expect(sync.pending).toBe(0);
  });

  it("une collection modifiée pendant l'envoi est renvoyée", async () => {
    const { sb, state } = fakeSb();
    const sync = new CloudSync("u1", source, sb);
    state.onUpsert = () => {
      state.onUpsert = null;
      sync.markData(["clients"]);
    };
    sync.markData(["clients"]);
    await sync.flush();
    sync.stop();
    expect(sync.pendingData()).toEqual(["clients"]);
  });
});
