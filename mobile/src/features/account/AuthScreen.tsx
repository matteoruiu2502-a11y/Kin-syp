import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FREE_PATIENT_LIMIT, SUBSCRIPTION_LABEL } from '../../core';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';
import { useAuth } from './AuthContext';

/** Pages légales publiées avec la version web (GitHub Pages). */
const LEGAL_URL = 'https://matteoruiu2502-a11y.github.io/Kin-syp/legal';

/** Création du compte praticien / connexion. */
export function AuthScreen() {
  const auth = useAuth();
  const [tab, setTab] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'signup') await auth.signup(email, password, name);
      else await auth.login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.brand}>
            Kiné<Text style={styles.brandAccent}>SyP</Text>
          </Text>
          <Text style={styles.lead}>L’angle se mesure seul, le bilan se rédige seul.</Text>
          <Text style={styles.offer}>• {FREE_PATIENT_LIMIT} patients gratuits pour tout essayer</Text>
          <Text style={styles.offer}>• Ensuite {SUBSCRIPTION_LABEL}, patients illimités, sans engagement</Text>
          <Text style={styles.offer}>• Analyse vidéo sur la tablette : aucune image envoyée</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.tabs}>
            {(['signup', 'login'] as const).map((t) => (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'signup' ? 'Créer un compte' : 'Se connecter'}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'signup' && (
            <TextInput style={styles.input} placeholder="Nom du praticien" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} autoComplete="name" />
          )}
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            style={styles.input}
            placeholder={tab === 'signup' ? 'Mot de passe (8 caractères minimum)' : 'Mot de passe'}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <BigButton label={busy ? '…' : tab === 'signup' ? 'Créer mon compte' : 'Se connecter'} variant="primary" onPress={submit} />
          {tab === 'signup' && (
            <Text style={styles.muted}>
              En créant un compte, vous acceptez les{' '}
              <Text style={styles.link} onPress={() => Linking.openURL(`${LEGAL_URL}/cgu.html`)}>
                conditions générales
              </Text>{' '}
              et la{' '}
              <Text style={styles.link} onPress={() => Linking.openURL(`${LEGAL_URL}/confidentialite.html`)}>
                politique de confidentialité
              </Text>
              .
            </Text>
          )}
          {auth.mode === 'local' && (
            <Text style={styles.muted}>Mode démonstration : comptes enregistrés sur cette tablette et paiement simulé. Configurez l’URL du serveur pour la production.</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, padding: spacing.xl },
  intro: { flexBasis: 360, flexGrow: 1, maxWidth: 520, gap: spacing.sm },
  brand: { color: colors.text, fontSize: 52, fontWeight: '900' },
  brandAccent: { color: colors.primary },
  lead: { color: colors.text, fontSize: font.title, fontWeight: '600', marginBottom: spacing.sm },
  offer: { color: colors.textMuted, fontSize: font.body },
  card: { flexBasis: 360, flexGrow: 1, maxWidth: 460, backgroundColor: colors.surfaceStrong, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.md, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.md - 4, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: font.caption + 1, fontWeight: '700' },
  tabTextOn: { color: colors.background },
  input: { minHeight: TOUCH_TARGET - 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.body },
  error: { color: colors.warning, fontSize: font.caption },
  muted: { color: colors.textMuted, fontSize: font.caption - 2 },
  link: { color: colors.primary, textDecorationLine: 'underline' },
});
