import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MEASURE_MODE_LABELS, type MeasureMode } from '../../core';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';

const MODES: MeasureMode[] = ['standard', 'sport', 'pediatric', 'posture'];
const ICONS: Record<MeasureMode, string> = { standard: '📐', sport: '🏃', pediatric: '🧸', posture: '🧍' };

export function ModeSelector({ mode, onChange }: { mode: MeasureMode; onChange: (m: MeasureMode) => void }) {
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {MODES.map((m) => {
        const selected = m === mode;
        return (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(m)}
            style={[styles.tab, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {ICONS[m]} {MEASURE_MODE_LABELS[m]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  tab: {
    minHeight: TOUCH_TARGET - 16,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg - 4,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary },
  label: { color: colors.text, fontSize: font.caption + 1, fontWeight: '700' },
  labelSelected: { color: colors.background },
});
