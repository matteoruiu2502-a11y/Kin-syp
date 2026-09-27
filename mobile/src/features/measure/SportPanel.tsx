import { StyleSheet, Text, View } from 'react-native';

import {
  JOINTS,
  JOINTS_BY_ID,
  LSI_RETURN_TO_SPORT,
  symmetries,
  type JointAnalysis,
  type JointId,
  type Repetition,
} from '../../core';
import { colors, font, radius, spacing } from '../../ui/theme';

interface SportPanelProps {
  analysis: JointAnalysis;
  repCount: number;
  lastRep: Repetition | null;
}

/** Mode kiné du sport : asymétrie G/D (LSI) et vitesse d'exécution. */
export function SportPanel({ analysis, repCount, lastRep }: SportPanelProps) {
  const peaks: Partial<Record<JointId, number | null>> = {};
  for (const j of JOINTS) {
    const m = analysis.joints[j.id];
    const moved = m.peak !== null && m.min !== null && m.peak - m.min >= 10;
    peaks[j.id] = moved ? m.peak : null;
  }
  const sym = symmetries(peaks);
  const active = analysis.activeJointId ? JOINTS_BY_ID[analysis.activeJointId] : null;

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Symétrie G/D</Text>
      {sym.length === 0 && <Text style={styles.muted}>Mesurez les deux côtés pour calculer l'asymétrie.</Text>}
      {sym.map((s) => {
        const ok = s.lsi >= LSI_RETURN_TO_SPORT;
        return (
          <View key={s.kind} style={styles.row}>
            <Text style={styles.rowLabel}>{s.label}</Text>
            <Text style={[styles.rowValue, { color: ok ? colors.active : colors.warning }]}>
              {ok ? '●' : '▲'} {s.asymmetryPercent} %
            </Text>
            <Text style={styles.muted}>LSI {s.lsi} %</Text>
          </View>
        );
      })}

      <Text style={[styles.title, styles.spaced]}>Vitesse {active ? `· ${active.label}` : ''}</Text>
      <View style={styles.row}>
        <Text style={styles.big}>{repCount}</Text>
        <Text style={styles.muted}>répétition{repCount > 1 ? 's' : ''}</Text>
      </View>
      {lastRep ? (
        <>
          <Text style={styles.stat}>
            Durée <Text style={styles.strong}>{((lastRep.endMs - lastRep.startMs) / 1000).toFixed(2)} s</Text>
          </Text>
          <Text style={styles.stat}>
            Vitesse max <Text style={styles.strong}>{Math.round(lastRep.peakVelocity)} °/s</Text>
          </Text>
          <Text style={styles.stat}>
            Amplitude <Text style={styles.strong}>{Math.round(lastRep.range)}°</Text>
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>Effectuez un mouvement complet aller-retour.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    minWidth: 260,
    gap: 2,
  },
  title: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  spaced: { marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowLabel: { color: colors.text, fontSize: font.caption, width: 72 },
  rowValue: { fontSize: font.body, fontWeight: '800', fontVariant: ['tabular-nums'] },
  big: { color: colors.text, fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  stat: { color: colors.textMuted, fontSize: font.caption },
  strong: { color: colors.text, fontWeight: '800', fontSize: font.body },
  muted: { color: colors.textMuted, fontSize: font.caption },
});
