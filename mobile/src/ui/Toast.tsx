import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from './theme';

export interface ToastMessage {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

let counter = 0;
export function makeToast(text: string, tone: ToastMessage['tone']): ToastMessage {
  counter += 1;
  return { id: counter, text, tone };
}

/** Message éphémère (3 s), lisible de loin. */
export function Toast({ message }: { message: ToastMessage | null }) {
  const [visible, setVisible] = useState<ToastMessage | null>(message);
  useEffect(() => {
    setVisible(message);
    if (!message) return;
    const t = setTimeout(() => setVisible(null), 3000);
    return () => clearTimeout(t);
  }, [message]);
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={styles.container}>
      <View style={[styles.toast, visible.tone === 'error' && styles.error]}>
        <Text style={styles.text}>{visible.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: '40%', left: 0, right: 0, alignItems: 'center' },
  toast: {
    backgroundColor: 'rgba(22, 101, 52, 0.95)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  error: { backgroundColor: colors.dangerSurface },
  text: { color: colors.text, fontSize: font.title, fontWeight: '800' },
});
