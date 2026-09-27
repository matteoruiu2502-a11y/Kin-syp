import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '../../ui/theme';
import { useDictation } from './useDictation';

interface DictationButtonProps {
  onNote: (text: string) => void;
  /** Bulle de transcription affichée au-dessus (écran de mesure) ou en ligne. */
  compact?: boolean;
}

/** Gros bouton micro : appui pour dicter, nouvel appui pour terminer. */
export function DictationButton({ onNote, compact }: DictationButtonProps) {
  const { state, toggle } = useDictation(onNote);
  return (
    <View style={styles.wrapper}>
      {(state.listening || state.error) && (
        <View style={[styles.bubble, compact && styles.bubbleFloating]}>
          {state.error ? (
            <Text style={styles.error}>{state.error}</Text>
          ) : (
            <>
              <Text style={styles.transcript}>{state.transcript || 'Je vous écoute…'}</Text>
              <Text style={styles.hint}>
                {state.onDevice ? '🔒 Reconnaissance sur l’appareil' : '⚠ Reconnaissance en ligne (service du système)'}
              </Text>
            </>
          )}
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.listening ? 'Terminer la dictée' : 'Dicter une observation'}
        onPress={toggle}
        style={({ pressed }) => [styles.button, state.listening && styles.listening, pressed && styles.pressed]}
      >
        <Text style={styles.icon}>{state.listening ? '■' : '🎙'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-end' },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listening: { backgroundColor: colors.danger, borderColor: colors.danger },
  pressed: { opacity: 0.7 },
  icon: { fontSize: 34, color: colors.text },
  bubble: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    maxWidth: 520,
  },
  bubbleFloating: { position: 'absolute', bottom: 92, right: 0, width: 420 },
  transcript: { color: colors.text, fontSize: font.body },
  hint: { color: colors.textMuted, fontSize: font.caption - 2, marginTop: spacing.xs },
  error: { color: colors.warning, fontSize: font.caption },
});
