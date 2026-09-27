import { StyleSheet, Text, View } from 'react-native';

import type { PostureAnalysis } from '../../core';
import { colors, font, radius, spacing } from '../../ui/theme';

/** Mode posturologie : alignement épaules / bassin / tête / fil à plomb. */
export function PosturePanel({ posture }: { posture: PostureAnalysis | null }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>
        Posture {posture ? (posture.view === 'front' ? '· vue de face' : '· vue de profil') : ''}
      </Text>
      {!posture && <Text style={styles.muted}>Patient debout, immobile, de face ou de profil.</Text>}
      {posture?.metrics.map((m) => (
        <View key={m.key} style={styles.row}>
          <Text style={[styles.icon, { color: m.status === 'ok' ? colors.active : colors.warning }]}>
            {m.status === 'ok' ? '●' : '▲'}
          </Text>
          <View style={styles.texts}>
            <Text style={styles.label}>
              {m.label} <Text style={styles.value}>{m.value}{m.unit === '°' ? '°' : ' %'}</Text>
            </Text>
            <Text style={styles.muted}>{m.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    minWidth: 280,
    maxWidth: 360,
    gap: spacing.xs,
  },
  title: { color: colors.text, fontSize: font.body, fontWeight: '800' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  icon: { fontSize: font.body, fontWeight: '900', width: 20 },
  texts: { flex: 1 },
  label: { color: colors.text, fontSize: font.caption + 1 },
  value: { fontWeight: '900', fontVariant: ['tabular-nums'] },
  muted: { color: colors.textMuted, fontSize: font.caption - 2 },
});
