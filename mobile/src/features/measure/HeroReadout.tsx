import { StyleSheet, Text, View } from 'react-native';

import { JOINTS_BY_ID, compareToNorm, type JointAnalysis, type Norm } from '../../core';
import { colors, font, radius, spacing } from '../../ui/theme';
import { formatJointValue, measurementColor } from './format';

interface HeroReadoutProps {
  analysis: JointAnalysis;
  /** Norme du patient courant pour l'articulation active (si patient connu). */
  norm: Norm | null;
}

/** Angle de l'articulation active, en très grand : lisible à 2 m. */
export function HeroReadout({ analysis, norm }: HeroReadoutProps) {
  const id = analysis.activeJointId;
  if (!id) return null;
  const m = analysis.joints[id];
  const def = JOINTS_BY_ID[id];
  const color = measurementColor(m, true);
  const cmp = norm && m.peak !== null ? compareToNorm(m.peak, norm) : null;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.label}>
        {def.label} · {def.movement}
        {analysis.focusLocked ? '  🔒' : ''}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]} adjustsFontSizeToFit numberOfLines={1}>
          {formatJointValue(id, m.value)}
        </Text>
        <Text style={[styles.unit, { color }]}>°</Text>
      </View>
      <Text style={styles.stats}>
        Max <Text style={styles.statsStrong}>{formatJointValue(id, m.peak)}°</Text>
        {'   '}Min <Text style={styles.statsStrong}>{formatJointValue(id, m.min)}°</Text>
        {cmp && norm ? `   ${cmp.percent} % de la norme (${norm.max}°)` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minWidth: 300,
    maxWidth: 560,
  },
  label: { color: colors.text, fontSize: font.body, fontWeight: '700' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start' },
  value: {
    fontSize: font.hero,
    lineHeight: font.hero * 1.05,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: font.heroUnit, fontWeight: '800', marginTop: spacing.sm },
  stats: { color: colors.textMuted, fontSize: font.body, fontVariant: ['tabular-nums'] },
  statsStrong: { color: colors.text, fontWeight: '800' },
});
