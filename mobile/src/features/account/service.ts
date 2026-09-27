import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import { httpAccountService, localAccountService, type AccountService, type KeyValue } from '../../core';

/**
 * Serveur KinéSyP si `expo.extra.apiUrl` est configuré (app.json), sinon
 * mode démonstration : comptes sur la tablette et paiement simulé.
 */
function fileKv(): KeyValue {
  const dir = new Directory(Paths.document, 'kinesyp');
  const file = () => {
    if (!dir.exists) dir.create({ intermediates: true });
    return new File(dir, 'accounts-demo.json');
  };
  let cache: Record<string, string> | null = null;
  const read = async () => {
    if (cache) return cache;
    const f = file();
    cache = f.exists ? (JSON.parse(await f.text()) as Record<string, string>) : {};
    return cache;
  };
  return {
    get: async (k) => (await read())[k] ?? null,
    set: async (k, v) => {
      const data = await read();
      data[k] = v;
      const f = file();
      if (!f.exists) f.create();
      f.write(JSON.stringify(data));
    },
  };
}

/** Démonstration uniquement : SHA-256 itéré (la production vérifie les mots de passe côté serveur, en scrypt). */
async function demoHash(password: string, salt: string): Promise<string> {
  let h = `${salt}:${password}`;
  for (let i = 0; i < 500; i++) h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${h}`);
  return h;
}

const apiUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const accountService: AccountService = apiUrl
  ? httpAccountService(apiUrl)
  : localAccountService(fileKv(), { hash: demoHash, randomId: () => Crypto.randomUUID() });
