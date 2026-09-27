import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  JOINT_KINDS,
  JOINTS_BY_ID,
  SIDES,
  ageAt,
  compareToNorm,
  formatDateFr,
  jointId,
  normFor,
  removeNote,
  symmetries,
  type JointId,
  type NormStatus,
  type StructuredNote,
} from '../../core';
import { useAppStore } from '../../data/AppStore';
import { useNavigate } from '../../navigation';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';
import { Toast, makeToast, type ToastMessage } from '../../ui/Toast';
import { DictationButton } from '../dictation/DictationButton';
import { useSessionActions } from '../session/useSessionActions';

const STATUS: Record<NormStatus, { icon: string; color: string; label: string }> = {
  normal: { icon: '●', color: colors.active, label: 'normale' },
  limited: { icon: '▲', color: colors.warning, label: 'limitée' },
  severe: { icon: '■', color: colors.danger, label: 'très limitée' },
};

function NoteCard({ note, onDelete }: { note: StructuredNote; onDelete: () => void }) {
  return (
    <View style={styles.note}>
      <View style={styles.noteBody}>
        {note.measures.map((m, i) => (
          <Text key={`m${i}`} style={styles.noteLine}>
            📐 {m.movement} {m.region.toLowerCase()} {m.side === 'left' ? 'gauche' : m.side === 'right' ? 'droit' : ''} :{' '}
            <Text style={styles.strong}>{m.value}°</Text>
          </Text>
        ))}
        {note.pain.map((p, i) => (
          <Text key={`p${i}`} style={styles.noteLine}>
            ⚡ Douleur <Text style={styles.strong}>{p.level}</Text>
            {p.eva !== null ? ` (EVA ${p.eva}/10)` : ''}
            {p.context ? ` ${p.context}` : ''}
          </Text>
        ))}
        {note.observations.map((o, i) => (
          <Text key={`o${i}`} style={styles.noteLine}>
            📝 {o}
          </Text>
        ))}
        <Text style={styles.raw}>« {note.raw} »</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Supprimer la note" onPress={onDelete} hitSlop={12} style={styles.delete}>
        <Text style={styles.deleteText}>✕</Text>
      </Pressable>
    </View>
  );
}

/**
 * Bilan de la séance : relecture des mesures (comparées aux normes),
 * dictée / saisie des observations, export PDF en un clic.
 */
export function ReportScreen() {
  const insets = useSafeAreaInsets();
  const navigate = useNavigate();
  const { currentPatient, sessions, todaySession, updateTodaySession } = useAppStore();
  const { busy, addDictation, exportPdf } = useSessionActions();
  const [typed, setTyped] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const notify = (r: { ok: boolean; message: string }) => setToast(makeToast(r.message, r.ok ? 'success' : 'error'));

  if (!currentPatient) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.title}>Aucun patient sélectionné</Text>
        <BigButton label="Choisir un patient" variant="primary" onPress={() => navigate('patients')} />
      </View>
    );
  }

  const session = todaySession ?? sessions[sessions.length - 1] ?? null;
  const age = ageAt(currentPatient.birthDate, session?.date ?? new Date().toISOString());
  const peaks: Partial<Record<JointId, number>> = {};
  for (const [id, r] of Object.entries(session?.joints ?? {})) peaks[id as JointId] = r!.peak;
  const sym = symmetries(peaks);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={[styles.header, { paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}>
        <BigButton label="← Mesure" onPress={() => navigate('measure')} />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            Bilan · {currentPatient.lastName.toUpperCase()} {currentPatient.firstName}
          </Text>
          <Text style={styles.muted}>
            {age} ans · {currentPatient.sex === 'F' ? 'femme' : 'homme'} ·{' '}
            {session ? `séance du ${formatDateFr(session.date)}` : 'aucune séance'} · {sessions.length} séance
            {sessions.length > 1 ? 's' : ''} au total
          </Text>
        </View>
        <BigButton
          label={busy === 'pdf' ? 'Génération…' : '📄 Exporter le PDF'}
          variant="primary"
          onPress={async () => notify(await exportPdf())}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl, paddingLeft: insets.left + spacing.lg, paddingRight: insets.right + spacing.lg }]}
      >
        <View style={styles.column}>
          <Text style={styles.section}>Amplitudes</Text>
          {!session || Object.keys(session.joints).length === 0 ? (
            <Text style={styles.muted}>Aucune amplitude enregistrée. Mesurez puis appuyez sur « Enregistrer ».</Text>
          ) : (
            JOINT_KINDS.flatMap((kind) =>
              SIDES.map((side) => {
                const r = session.joints[jointId(kind, side)];
                if (!r) return null;
                const def = JOINTS_BY_ID[r.jointId];
                const norm = normFor(kind, age, currentPatient.sex);
                const cmp = compareToNorm(r.peak, norm);
                const st = STATUS[cmp.status];
                return (
                  <View key={r.jointId} style={styles.measureRow}>
                    <Text style={styles.measureLabel}>{def.label}</Text>
                    <Text style={styles.measureValue}>{Math.round(r.peak)}°</Text>
                    <Text style={styles.muted}>
                      / {norm.max}° ({cmp.percent} %)
                    </Text>
                    <Text style={[styles.status, { color: st.color }]}>
                      {st.icon} {st.label}
                    </Text>
                  </View>
                );
              }),
            )
          )}

          {sym.length > 0 && (
            <>
              <Text style={[styles.section, styles.spaced]}>Symétrie G/D</Text>
              {sym.map((s) => (
                <Text key={s.kind} style={styles.line}>
                  {s.label} : LSI <Text style={styles.strong}>{s.lsi} %</Text> — asymétrie {s.asymmetryPercent} %
                </Text>
              ))}
            </>
          )}

          {session && session.sport.length > 0 && (
            <>
              <Text style={[styles.section, styles.spaced]}>Sport</Text>
              {session.sport.map((s) => (
                <Text key={s.jointId} style={styles.line}>
                  {JOINTS_BY_ID[s.jointId].label} : {s.count} rép. · {s.meanDurationS.toFixed(2)} s · max{' '}
                  <Text style={styles.strong}>{s.bestPeakVelocity} °/s</Text>
                </Text>
              ))}
            </>
          )}

          {session && session.posture.length > 0 && (
            <>
              <Text style={[styles.section, styles.spaced]}>Posture</Text>
              {session.posture.flatMap((p) =>
                p.metrics.map((m) => (
                  <Text key={`${p.view}-${m.key}`} style={styles.line}>
                    <Text style={{ color: m.status === 'ok' ? colors.active : colors.warning }}>{m.status === 'ok' ? '●' : '▲'}</Text>{' '}
                    {m.label} : <Text style={styles.strong}>{m.value}{m.unit === '°' ? '°' : ' %'}</Text> — {m.detail}
                  </Text>
                )),
              )}
            </>
          )}

          {session && session.photos.length > 0 && (
            <>
              <Text style={[styles.section, styles.spaced]}>Captures</Text>
              <View style={styles.photos}>
                {session.photos.slice(-6).map((p) => (
                  <View key={p.uri} style={styles.photo}>
                    <Image source={{ uri: p.uri }} style={styles.photoImage} resizeMode="cover" />
                    <Text style={styles.photoCaption} numberOfLines={2}>
                      {p.caption}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.column}>
          <View style={styles.dictationHeader}>
            <Text style={styles.section}>Observations</Text>
            <DictationButton onNote={(text) => notify(addDictation(text))} />
          </View>
          <Text style={styles.muted}>
            Exemple : « Flexion genou droit 90 degrés, légère douleur en fin de course ».
          </Text>
          <View style={styles.typedRow}>
            <TextInput
              style={styles.input}
              placeholder="…ou saisissez une observation"
              placeholderTextColor={colors.textMuted}
              value={typed}
              onChangeText={setTyped}
              multiline
            />
            <BigButton
              label="Ajouter"
              onPress={() => {
                if (!typed.trim()) return;
                notify(addDictation(typed));
                setTyped('');
              }}
            />
          </View>
          {session?.notes.length ? (
            [...session.notes].reverse().map((n) => (
              <NoteCard key={n.id} note={n} onDelete={() => updateTodaySession((s) => removeNote(s, n.id))} />
            ))
          ) : (
            <Text style={styles.muted}>Aucune observation pour cette séance.</Text>
          )}
        </View>
      </ScrollView>
      <Toast message={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md, flexWrap: 'wrap' },
  headerText: { flex: 1, minWidth: 240 },
  title: { color: colors.text, fontSize: font.title + 2, fontWeight: '900' },
  content: { flexDirection: 'row', gap: spacing.xl, flexWrap: 'wrap' },
  column: { flex: 1, minWidth: 340, gap: spacing.sm },
  section: { color: colors.text, fontSize: font.title - 4, fontWeight: '800' },
  spaced: { marginTop: spacing.lg },
  muted: { color: colors.textMuted, fontSize: font.caption },
  strong: { color: colors.text, fontWeight: '800' },
  line: { color: colors.textMuted, fontSize: font.caption + 1 },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  measureLabel: { color: colors.text, fontSize: font.body, fontWeight: '700', width: 110 },
  measureValue: { color: colors.text, fontSize: font.title, fontWeight: '900', fontVariant: ['tabular-nums'] },
  status: { marginLeft: 'auto', fontSize: font.caption + 1, fontWeight: '800' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 150 },
  photoImage: { width: 150, height: 110, borderRadius: radius.md, backgroundColor: colors.surfaceStrong },
  photoCaption: { color: colors.textMuted, fontSize: 12 },
  dictationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typedRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: font.body,
  },
  note: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noteBody: { flex: 1, gap: 2 },
  noteLine: { color: colors.text, fontSize: font.caption + 1 },
  raw: { color: colors.textMuted, fontSize: font.caption - 2, fontStyle: 'italic', marginTop: spacing.xs },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.textMuted, fontSize: font.body },
});
