import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JOINTS, type JointAnalysis, type JointId } from '../../core';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';
import { formatDegrees, measurementColor } from './format';

interface JointCardsProps {
  analysis: JointAnalysis;
  /** Appui : verrouille le focus ; nouvel appui sur la carte verrouillée : retour en auto. */
  onSelect: (id: JointId | null) => void;
  direction: 'row' | 'column';
}

export function JointCards({ analysis, onSelect, direction }: JointCardsProps) {
  return (
    <View style={[styles.container, { flexDirection: direction }]}>
      {JOINTS.map((def) => {
        const m = analysis.joints[def.id];
        const isActive = analysis.activeJointId === def.id;
        const locked = analysis.focusLocked && isActive;
        const color = measurementColor(m, isActive);
        return (
          <Pressable
            key={def.id}
            accessibilityRole="button"
            accessibilityState={{ selected: locked }}
            accessibilityLabel={`${def.label} ${formatDegrees(m.flexion)} degrés`}
            onPress={() => onSelect(locked ? null : def.id)}
            style={({ pressed }) => [
              styles.card,
              isActive && { borderColor: color },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.label}>
              {def.label}
              {locked ? ' 🔒' : ''}
            </Text>
            <Text style={[styles.value, { color }]}>{formatDegrees(m.flexion)}°</Text>
            <Text style={styles.peak}>max {formatDegrees(m.peakFlexion)}°</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  card: {
    minHeight: TOUCH_TARGET,
    minWidth: 128,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  label: { color: colors.textMuted, fontSize: font.caption, fontWeight: '700' },
  value: { fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  peak: { color: colors.textMuted, fontSize: font.caption, fontVariant: ['tabular-nums'] },
});
