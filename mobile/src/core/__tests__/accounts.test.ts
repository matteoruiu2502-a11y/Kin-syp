import { AccountError, httpAccountService, localAccountService, type KeyValue } from '../account';

function memoryKv(): KeyValue {
  const m = new Map<string, string>();
  return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) };
}
let seq = 0;
const testCrypto = {
  // Empreinte factice : suffit pour vérifier la logique (le vrai hachage est fourni par la plateforme).
  hash: async (p: string, s: string) => `${s}:${[...p].reverse().join('')}`,
  randomId: () => `id-${++seq}`,
};

describe('comptes (mode démonstration local)', () => {
  it('inscrit, connecte et applique le quota de 5 patients', async () => {
    const svc = localAccountService(memoryKv(), testCrypto);
    const { token } = await svc.signup({ email: 'Lea@Cabinet.fr', password: 'motdepasse1', name: 'Léa' });
    await expect(svc.login({ email: 'lea@cabinet.fr', password: 'mauvais' })).rejects.toMatchObject({ code: 'bad_credentials' });
    const session = await svc.login({ email: 'lea@cabinet.fr', password: 'motdepasse1' });
    expect(session.token).toBe(token);

    for (let i = 0; i < 5; i++) await svc.registerPatient(token, `p${i}`);
    await svc.registerPatient(token, 'p2'); // idempotent
    await expect(svc.registerPatient(token, 'p5')).rejects.toMatchObject({ code: 'quota_exceeded' });

    expect((await svc.startCheckout(token)).simulation).toBe(true);
    const v = await svc.simulate!(token, 'subscribe');
    expect(v.entitlement).toMatchObject({ subscribed: true, patientLimit: null });
    await svc.registerPatient(token, 'p5');
    expect((await svc.me(token)).entitlement.patientCount).toBe(6);
  });

  it('isole les comptes et refuse les doublons', async () => {
    const kv = memoryKv();
    const svc = localAccountService(kv, testCrypto);
    await svc.signup({ email: 'a@kine.fr', password: 'motdepasse1', name: 'A' });
    await expect(svc.signup({ email: 'A@kine.fr', password: 'motdepasse1', name: 'A' })).rejects.toBeInstanceOf(AccountError);
    const b = await svc.signup({ email: 'b@kine.fr', password: 'motdepasse2', name: 'B' });
    expect(b.view.entitlement.patientCount).toBe(0);
  });
});

describe('client du serveur', () => {
  it('transmet le jeton et traduit les erreurs', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ error: 'quota_exceeded', message: 'Limite atteinte' }), { status: 402 });
    }) as unknown as typeof fetch;
    const svc = httpAccountService('https://api.kinesyp.test/', fakeFetch);
    await expect(svc.registerPatient('tok', 'p1')).rejects.toMatchObject({ code: 'quota_exceeded', message: 'Limite atteinte' });
    expect(calls[0].url).toBe('https://api.kinesyp.test/patients');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
