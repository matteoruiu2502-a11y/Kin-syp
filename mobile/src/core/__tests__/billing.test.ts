import { FREE_PATIENT_LIMIT, NO_SUBSCRIPTION, entitlement, isSubscriptionActive } from '../billing';

const now = new Date('2026-09-27T12:00:00Z');

describe('offre', () => {
  it('autorise 5 patients gratuits puis bloque', () => {
    expect(entitlement(NO_SUBSCRIPTION, 4, now)).toMatchObject({ canCreatePatient: true, remainingFree: 1 });
    expect(entitlement(NO_SUBSCRIPTION, FREE_PATIENT_LIMIT, now)).toMatchObject({ canCreatePatient: false, remainingFree: 0 });
  });

  it('lève la limite pour un abonné', () => {
    const e = entitlement({ status: 'active', currentPeriodEnd: '2026-10-27T00:00:00Z', cancelAtPeriodEnd: false }, 40, now);
    expect(e).toMatchObject({ subscribed: true, canCreatePatient: true, patientLimit: null });
  });

  it("garde l'accès jusqu'à la fin de la période après résiliation", () => {
    expect(isSubscriptionActive({ status: 'canceled', currentPeriodEnd: '2026-10-01T00:00:00Z', cancelAtPeriodEnd: true }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'canceled', currentPeriodEnd: '2026-09-20T00:00:00Z', cancelAtPeriodEnd: true }, now)).toBe(false);
  });

  it('laisse un délai de grâce après un échec de paiement', () => {
    expect(isSubscriptionActive({ status: 'past_due', currentPeriodEnd: '2026-09-24T00:00:00Z', cancelAtPeriodEnd: false }, now)).toBe(true);
    expect(isSubscriptionActive({ status: 'past_due', currentPeriodEnd: '2026-09-10T00:00:00Z', cancelAtPeriodEnd: false }, now)).toBe(false);
    expect(isSubscriptionActive({ status: 'unpaid', currentPeriodEnd: '2026-10-01T00:00:00Z', cancelAtPeriodEnd: false }, now)).toBe(false);
  });
});
