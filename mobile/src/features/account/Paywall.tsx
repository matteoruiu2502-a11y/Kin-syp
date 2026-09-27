import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { FREE_PATIENT_LIMIT, SUBSCRIPTION_LABEL } from '../../core';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing } from '../../ui/theme';
import { useAuth } from './AuthContext';

/** Offre d'abonnement (quota atteint ou demande depuis la page Patients). */
export function Paywall() {
  const auth = useAuth();
  const [step, setStep] = useState<'offer' | 'simulated'>('offer');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!auth.view) return null;
  const e = auth.view.entitlement;

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const { simulation } = await auth.subscribe();
      if (simulation) setStep('simulated');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={auth.paywall} transparent animationType="fade" onRequestClose={auth.closePaywall} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {step === 'offer' ? (
            <>
              <Text style={styles.title}>{e.canCreatePatient ? 'Passer à l’abonnement' : `Vos ${FREE_PATIENT_LIMIT} patients gratuits sont utilisés`}</Text>
              <Text style={styles.muted}>Continuez à suivre vos patients sans limite, avec toutes les fonctions.</Text>
              <Text style={styles.price}>50 €</Text>
              <Text style={styles.muted}>par mois, par praticien · sans engagement</Text>
              <Text style={styles.item}>• Patients illimités</Text>
              <Text style={styles.item}>• Mesure automatique, compensations, mode fantôme</Text>
              <Text style={styles.item}>• Dictée, bilan PDF, modes Sport, Pédiatrie, Posturo</Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.row}>
                <BigButton label={busy ? '…' : `S’abonner — ${SUBSCRIPTION_LABEL}`} variant="primary" onPress={subscribe} />
                <BigButton label="Plus tard" onPress={auth.closePaywall} />
              </View>
              <Text style={styles.small}>Paiement sécurisé par Stripe, dans le navigateur. Résiliable à tout moment.</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Paiement simulé</Text>
              <Text style={styles.warn}>Mode démonstration : aucun paiement réel. En production, cette étape est la page de paiement Stripe.</Text>
              <View style={styles.row}>
                <BigButton
                  label="Confirmer l’abonnement simulé"
                  variant="primary"
                  onPress={async () => {
                    await auth.simulate('subscribe');
                    setStep('offer');
                    auth.closePaywall();
                  }}
                />
                <BigButton label="Retour" onPress={() => setStep('offer')} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(3, 6, 12, 0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 520, backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontSize: font.title, fontWeight: '900' },
  price: { color: colors.primary, fontSize: 64, fontWeight: '900', marginTop: spacing.sm },
  item: { color: colors.text, fontSize: font.body },
  muted: { color: colors.textMuted, fontSize: font.body },
  small: { color: colors.textMuted, fontSize: font.caption - 2 },
  warn: { color: colors.warning, fontSize: font.body },
  error: { color: colors.warning, fontSize: font.caption },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
});
