import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { BigButton } from '../../ui/BigButton';
import { colors, font, spacing } from '../../ui/theme';

export function PermissionGate({ children }: { children: ReactNode }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  if (hasPermission) return <>{children}</>;

  const request = async () => {
    const granted = await requestPermission();
    if (!granted) await Linking.openSettings();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accès caméra requis</Text>
      <Text style={styles.body}>
        La caméra sert uniquement à mesurer les amplitudes articulaires. Les images sont
        analysées sur la tablette et ne sont jamais envoyées sur Internet.
      </Text>
      <BigButton label="Autoriser la caméra" variant="primary" onPress={request} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: colors.text, fontSize: 40, fontWeight: '900', textAlign: 'center' },
  body: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 30,
  },
});
