import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MediapipeCamera } from 'react-native-mediapipe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Camera, CameraPosition } from 'react-native-vision-camera';

import { JOINTS_BY_ID, ageAt, localDate, normFor, type GhostTrack, type MeasureMode } from '../../core';
import { useAppStore } from '../../data/AppStore';
import { loadGhost } from '../../data/storage';
import { useNavigate } from '../../navigation';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing } from '../../ui/theme';
import { Toast, makeToast, type ToastMessage } from '../../ui/Toast';
import { DictationButton } from '../dictation/DictationButton';
import { useSessionActions } from '../session/useSessionActions';
import { AlertBanner } from './AlertBanner';
import { GhostOverlay } from './GhostOverlay';
import { HeroReadout } from './HeroReadout';
import { JointCards } from './JointCards';
import { ModeSelector } from './ModeSelector';
import { PatientChip } from './PatientChip';
import { PediatricOverlay } from './PediatricOverlay';
import { PosturePanel } from './PosturePanel';
import { PostureOverlay } from './PostureOverlay';
import { SkeletonOverlay } from './SkeletonOverlay';
import { SportPanel } from './SportPanel';
import { usePoseAnalysis } from './usePoseAnalysis';

/** Âge/sexe par défaut pour les normes quand aucun patient n'est choisi. */
const DEFAULT_PROFILE = { age: 30, sex: 'M' as const };
const DEFAULT_CHILD_PROFILE = { age: 6, sex: 'M' as const };

/**
 * Écran de mesure "zéro clic" : dès l'ouverture, la caméra analyse le
 * patient, l'articulation qui bouge est mise en avant et ses amplitudes
 * extrêmes sont capturées automatiquement. Enregistrer → Bilan → Exporter.
 */
export function MeasureScreen() {
  useKeepAwake(); // tablette sur trépied : l'écran ne doit pas se verrouiller
  const insets = useSafeAreaInsets();
  const navigate = useNavigate();
  const { currentPatient, sessions } = useAppStore();
  const cameraRef = useRef<Camera>(null);

  const [mode, setMode] = useState<MeasureMode>('standard');
  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const { solution, state, restart, setFocus, snapshot } = usePoseAnalysis(mode);
  const { busy, saveMeasure, addDictation } = useSessionActions();
  const { analysis, compensations, landmarks } = state;

  // --- Mode fantôme : squelette de la dernière séance antérieure.
  const [ghostOn, setGhostOn] = useState(false);
  const [ghost, setGhost] = useState<GhostTrack | null>(null);
  const today = localDate(new Date());
  const ghostSource = useMemo(
    () => [...sessions].reverse().find((s) => s.date < today && s.ghostFile) ?? null,
    [sessions, today],
  );
  useEffect(() => {
    setGhost(null);
    setGhostOn(false);
    if (ghostSource?.ghostFile) loadGhost(ghostSource.ghostFile).then(setGhost);
  }, [ghostSource]);

  // --- Normes du patient courant.
  const profile = currentPatient
    ? { age: ageAt(currentPatient.birthDate, today), sex: currentPatient.sex }
    : mode === 'pediatric'
      ? DEFAULT_CHILD_PROFILE
      : DEFAULT_PROFILE;
  const activeDef = analysis.activeJointId ? JOINTS_BY_ID[analysis.activeJointId] : null;
  const activeNorm = activeDef ? normFor(activeDef.kind, profile.age, profile.sex) : null;
  const active = analysis.activeJointId ? analysis.joints[analysis.activeJointId] : null;
  const outOfPlane = active?.tracked && active.outOfPlane;

  const changeMode = (m: MeasureMode) => {
    setMode(m);
    restart();
  };

  const onSave = async () => {
    const result = await saveMeasure(snapshot(), mode, cameraRef);
    setToast(makeToast(result.message, result.ok ? 'success' : 'error'));
    if (result.ok) restart();
    else if (!currentPatient) navigate('patients');
  };

  const onDictation = (text: string) => {
    const result = addDictation(text);
    setToast(makeToast(result.message, result.ok ? 'success' : 'error'));
  };

  return (
    <View style={styles.root}>
      <MediapipeCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        solution={solution}
        activeCamera={cameraPosition}
        resizeMode="cover"
      />
      {ghostOn && ghost && <GhostOverlay track={ghost} live={landmarks} />}
      <SkeletonOverlay landmarks={landmarks} analysis={analysis} compensations={compensations} />
      {mode === 'posture' && <PostureOverlay posture={state.posture} landmarks={landmarks} />}
      {mode === 'pediatric' && (
        <PediatricOverlay
          analysis={analysis}
          landmarks={landmarks}
          targetValue={activeNorm ? Math.round(activeNorm.max * 0.9) : null}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.hud,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.md,
            paddingRight: insets.right + spacing.md,
          },
        ]}
      >
        <View pointerEvents="box-none" style={styles.topBar}>
          <ModeSelector mode={mode} onChange={changeMode} />
          <View style={styles.topRight}>
            <PatientChip />
            <View style={styles.status}>
              <Text style={styles.statusText}>{state.fps} FPS</Text>
              <Text style={styles.statusMuted}>🔒 local</Text>
            </View>
          </View>
        </View>

        <View pointerEvents="box-none" style={styles.panels}>
          {mode === 'posture' ? (
            <PosturePanel posture={state.posture} />
          ) : mode !== 'pediatric' && landmarks ? (
            <HeroReadout analysis={analysis} norm={currentPatient ? activeNorm : null} />
          ) : (
            <View />
          )}
          {mode === 'sport' && <SportPanel analysis={analysis} repCount={state.repCount} lastRep={state.lastRep} />}
        </View>

        <View pointerEvents="none" style={styles.alerts}>
          {state.error && <AlertBanner tone="danger" message={`Erreur détection : ${state.error}`} />}
          {compensations.map((c) => (
            <AlertBanner key={c.kind} tone="danger" message={`${c.message} (${Math.round(c.deviationDeg)}°)`} />
          ))}
          {outOfPlane && activeDef && mode !== 'posture' && (
            <AlertBanner tone="warning" message={`${activeDef.label} hors du plan caméra : placez la tablette face au mouvement`} />
          )}
          {!landmarks && !state.error && (
            <AlertBanner tone="info" message="Placez le patient en entier dans le cadre (≈ 2 m)" />
          )}
          {landmarks && !state.calibrated && mode !== 'posture' && (
            <AlertBanner tone="info" message="Calibrage de la posture… restez immobile" />
          )}
        </View>

        <View pointerEvents="box-none" style={styles.bottom}>
          {mode !== 'posture' && <JointCards analysis={analysis} onSelect={setFocus} />}
          <View pointerEvents="box-none" style={styles.actionsRow}>
            <View style={styles.actions}>
              <BigButton label="↺" onPress={restart} accessibilityHint="Nouvelle série : remet à zéro les amplitudes" />
              <BigButton
                label="⇄"
                onPress={() => setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))}
                accessibilityHint="Bascule entre caméra arrière et frontale"
              />
              {ghost && (
                <BigButton
                  label={ghostOn ? '👻 Fantôme ✓' : '👻 Fantôme'}
                  onPress={() => setGhostOn((v) => !v)}
                  accessibilityHint={`Superpose le mouvement de la séance du ${ghostSource?.date ?? ''}`}
                />
              )}
              <BigButton
                label={busy === 'save' ? '…' : '💾 Enregistrer'}
                variant="primary"
                onPress={onSave}
                accessibilityHint="Enregistre les amplitudes, une photo et le squelette dans la séance du jour"
              />
              <BigButton label="📄 Bilan" onPress={() => navigate('report')} accessibilityHint="Ouvre le bilan de la séance" />
            </View>
            <DictationButton onNote={onDictation} compact />
          </View>
        </View>
      </View>
      <Toast message={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hud: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, flexWrap: 'wrap' },
  topRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  panels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: spacing.md, gap: spacing.md },
  status: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  statusText: { color: colors.text, fontSize: font.caption + 2, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statusMuted: { color: colors.textMuted, fontSize: font.caption - 2 },
  alerts: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  bottom: { gap: spacing.sm },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', flexShrink: 1 },
});
