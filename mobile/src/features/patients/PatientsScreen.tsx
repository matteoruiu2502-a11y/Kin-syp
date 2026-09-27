import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AccountError,
  FREE_PATIENT_LIMIT,
  SUBSCRIPTION_LABEL,
  ageAt,
  formatDateFr,
  localDate,
  newId,
  parseFrenchDate,
  planLabel,
  searchPatients,
  type Sex,
} from '../../core';
import { useAuth } from '../account/AuthContext';
import { useAppStore } from '../../data/AppStore';
import { useNavigate } from '../../navigation';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';

export function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const navigate = useNavigate();
  const { patients, currentPatient, selectPatient, addPatient, settings, updateSettings } = useAppStore();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birth, setBirth] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const today = localDate(new Date());
  // Sans accents, mots dans le désordre, ou date de naissance.
  const filtered = searchPatients(patients, query);

  const create = async () => {
    const birthDate = parseFrenchDate(birth);
    if (!lastName.trim() || !firstName.trim()) return setError('Nom et prénom requis');
    if (!birthDate) return setError('Date de naissance au format JJ/MM/AAAA');
    if (!sex) return setError('Précisez le sexe (normes d’amplitude)');
    const id = newId('p');
    setBusy(true);
    setError(null);
    try {
      // Le service de comptes réserve la place (quota) ; le dossier reste sur la tablette.
      await auth.registerPatient(id);
      addPatient({ id, lastName: lastName.trim(), firstName: firstName.trim(), birthDate, sex, createdAt: new Date().toISOString() });
      navigate('measure');
    } catch (e) {
      if (!(e instanceof AccountError && e.code === 'quota_exceeded')) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const ent = auth.view?.entitlement;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
      <View style={styles.header}>
        <BigButton label="← Mesure" onPress={() => navigate('measure')} />
        <Text style={styles.title}>Patients</Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <TextInput
            style={styles.input}
            placeholder="🔍 Rechercher : nom, prénom, date de naissance…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm }}
            ListEmptyComponent={<Text style={styles.muted}>Aucun patient. Créez-en un à droite.</Text>}
            renderItem={({ item }) => {
              const selected = item.id === currentPatient?.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    selectPatient(item.id);
                    navigate('measure');
                  }}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.rowName}>
                    {item.lastName.toUpperCase()} {item.firstName}
                  </Text>
                  <Text style={styles.muted}>
                    {item.sex === 'F' ? 'Femme' : 'Homme'} · {ageAt(item.birthDate, today)} ans · né(e) le {formatDateFr(item.birthDate)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <View style={styles.column}>
          <Text style={styles.section}>Nouveau patient</Text>
          <TextInput style={styles.input} placeholder="Nom" placeholderTextColor={colors.textMuted} value={lastName} onChangeText={setLastName} autoCapitalize="characters" />
          <TextInput style={styles.input} placeholder="Prénom" placeholderTextColor={colors.textMuted} value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          <TextInput
            style={styles.input}
            placeholder="Date de naissance (JJ/MM/AAAA)"
            placeholderTextColor={colors.textMuted}
            value={birth}
            onChangeText={setBirth}
            keyboardType="numbers-and-punctuation"
          />
          <View style={styles.sexRow}>
            {(['F', 'M'] as const).map((s) => (
              <Pressable
                key={s}
                accessibilityRole="radio"
                accessibilityState={{ checked: sex === s }}
                onPress={() => setSex(s)}
                style={[styles.sex, sex === s && styles.sexSelected]}
              >
                <Text style={[styles.sexText, sex === s && styles.sexTextSelected]}>{s === 'F' ? 'Femme' : 'Homme'}</Text>
              </Pressable>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <BigButton label={busy ? '…' : 'Créer et mesurer'} variant="primary" onPress={create} />

          {ent && auth.view && (
            <View style={styles.plan}>
              <Text style={styles.section}>Mon compte</Text>
              <Text style={styles.muted}>
                {auth.view.account.name} · {auth.view.account.email}
              </Text>
              <Text style={styles.planText}>{planLabel(ent)}</Text>
              {!ent.subscribed && (
                <View style={styles.quota}>
                  {Array.from({ length: FREE_PATIENT_LIMIT }, (_, i) => (
                    <View key={i} style={[styles.quotaSlot, i < ent.patientCount && styles.quotaUsed]} />
                  ))}
                </View>
              )}
              <View style={styles.sexRow}>
                {ent.subscribed ? (
                  auth.mode === 'server' ? (
                    <BigButton label="Gérer l’abonnement" onPress={() => auth.manageSubscription()} />
                  ) : (
                    <BigButton label="Résilier (simulation)" onPress={() => auth.simulate('cancel')} />
                  )
                ) : (
                  <BigButton label={`S’abonner — ${SUBSCRIPTION_LABEL}`} variant="primary" onPress={auth.openPaywall} />
                )}
                <BigButton label="Se déconnecter" onPress={() => auth.logout()} />
              </View>
            </View>
          )}

          <Text style={[styles.section, styles.spaced]}>Praticien (en-tête du bilan)</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom du praticien"
            placeholderTextColor={colors.textMuted}
            defaultValue={settings.practitionerName}
            onEndEditing={(e) => updateSettings({ practitionerName: e.nativeEvent.text.trim() })}
          />
          <TextInput
            style={styles.input}
            placeholder="Titre"
            placeholderTextColor={colors.textMuted}
            defaultValue={settings.practitionerTitle}
            onEndEditing={(e) => updateSettings({ practitionerTitle: e.nativeEvent.text.trim() })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 34, fontWeight: '900' },
  columns: { flex: 1, flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 320, gap: spacing.sm },
  section: { color: colors.text, fontSize: font.title - 4, fontWeight: '800' },
  spaced: { marginTop: spacing.lg },
  input: {
    minHeight: TOUCH_TARGET - 8,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.body,
  },
  row: {
    minHeight: TOUCH_TARGET,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: { borderColor: colors.primary },
  pressed: { opacity: 0.7 },
  rowName: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: font.caption },
  sexRow: { flexDirection: 'row', gap: spacing.sm },
  sex: {
    flex: 1,
    minHeight: TOUCH_TARGET - 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  sexText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  sexTextSelected: { color: colors.background },
  error: { color: colors.warning, fontSize: font.caption },
  plan: { gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.surfaceStrong, borderRadius: radius.md, padding: spacing.md },
  planText: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  quota: { flexDirection: 'row', gap: 6 },
  quotaSlot: { width: 36, height: 12, borderRadius: 6, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  quotaUsed: { backgroundColor: colors.primary, borderColor: colors.primary },
});
