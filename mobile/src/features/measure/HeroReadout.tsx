import { StyleSheet, Text, View } from 'react-native';

import { JOINTS_BY_ID, type JointAnalysis } from '../../core';
import { colors, font, radius, spacing } from '../../ui/theme';
import { formatDegrees, measurementColor, referencePercent } from './format';

/** Angle de l'articulation active, en très grand : lisible à 2 m. */
export function HeroReadout({ analysis }: { analysis: JointAnalysis }) {
  const id = analysis.activeJointId;
  if (!id) return null;
  const m = analysis.joints[id];
  const def = JOINTS_BY_ID[id];
  const color = measurementColor(m, true);
  const percent = referencePercent(m);

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.label}>
        Flexion {def.label}
        {analysis.focusLocked ? '  🔒' : ''}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]} adjustsFontSizeToFit numberOfLines={1}>
          {formatDegrees(m.flexion)}
        </Text>
        <Text style={[styles.unit, { color }]}>°</Text>
      </View>
      <Text style={styles.stats}>
        Max <Text style={styles.statsStrong}>{formatDegrees(m.peakFlexion)}°</Text>
        {'   '}Ext. <Text style={styles.statsStrong}>{formatDegrees(m.minFlexion)}°</Text>
        {percent !== null ? `   ${percent}% réf.` : ''}
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
  },
  label: { color: colors.text, fontSize: font.title, fontWeight: '700' },
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
