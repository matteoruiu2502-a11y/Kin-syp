import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JOINT_KINDS, JOINT_KIND_LABELS, SIDES, jointId, type JointAnalysis, type JointId } from '../../core';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';
import { formatJointValue, measurementColor } from './format';

interface JointCardsProps {
  analysis: JointAnalysis;
  /** Appui : verrouille le focus ; nouvel appui sur la valeur verrouillée : retour en auto. */
  onSelect: (id: JointId | null) => void;
}

/** Une carte par articulation, gauche et droite côte à côte (asymétrie visible d'un coup d'œil). */
export function JointCards({ analysis, onSelect }: JointCardsProps) {
  return (
    <View style={styles.container}>
      {JOINT_KINDS.map((kind) => {
        const anyActive = SIDES.some((s) => analysis.activeJointId === jointId(kind, s));
        return (
          <View key={kind} style={[styles.card, anyActive && styles.cardActive]}>
            <Text style={styles.kind}>{JOINT_KIND_LABELS[kind]}</Text>
            <View style={styles.sides}>
              {SIDES.map((side) => {
                const id = jointId(kind, side);
                const m = analysis.joints[id];
                const isActive = analysis.activeJointId === id;
                const locked = analysis.focusLocked && isActive;
                return (
                  <Pressable
                    key={side}
                    accessibilityRole="button"
                    accessibilityState={{ selected: locked }}
                    accessibilityLabel={`${JOINT_KIND_LABELS[kind]} ${side === 'left' ? 'gauche' : 'droit'} ${formatJointValue(id, m.value)} degrés`}
                    onPress={() => onSelect(locked ? null : id)}
                    hitSlop={4}
                    style={({ pressed }) => [styles.side, pressed && styles.pressed, locked && styles.locked]}
                  >
                    <Text style={styles.sideLabel}>
                      {side === 'left' ? 'G' : 'D'}
                      {locked ? ' 🔒' : ''}
                    </Text>
                    <Text style={[styles.value, { color: measurementColor(m, isActive) }]}>
                      {formatJointValue(id, m.value)}°
                    </Text>
                    <Text style={styles.peak}>max {formatJointValue(id, m.peak)}°</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  cardActive: { borderColor: colors.active },
  kind: { color: colors.textMuted, fontSize: font.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
  sides: { flexDirection: 'row', gap: spacing.xs },
  side: {
    minWidth: 84,
    minHeight: TOUCH_TARGET - 8,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md - 4,
    justifyContent: 'center',
  },
  locked: { backgroundColor: 'rgba(163, 230, 53, 0.15)' },
  pressed: { opacity: 0.6 },
  sideLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  value: { fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  peak: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
});
