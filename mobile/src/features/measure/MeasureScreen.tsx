import { useKeepAwake } from 'expo-keep-awake';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MediapipeCamera } from 'react-native-mediapipe';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraPosition } from 'react-native-vision-camera';

import { JOINTS_BY_ID } from '../../core';
import { BigButton } from '../../ui/BigButton';
import { colors, font, radius, spacing } from '../../ui/theme';
import { AlertBanner } from './AlertBanner';
import { HeroReadout } from './HeroReadout';
import { JointCards } from './JointCards';
import { SkeletonOverlay } from './SkeletonOverlay';
import { usePoseAnalysis } from './usePoseAnalysis';

/**
 * Écran de mesure "zéro clic" : dès l'ouverture, la caméra analyse le
 * patient, l'articulation qui bouge est mise en avant et ses amplitudes
 * extrêmes sont capturées automatiquement.
 */
export function MeasureScreen() {
  useKeepAwake(); // tablette sur trépied : l'écran ne doit pas se verrouiller
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [cameraPosition, setCameraPosition] = useState<CameraPosition>('back');
  const { solution, state, restart, setFocus } = usePoseAnalysis();
  const { analysis, compensations, landmarks } = state;

  const active = analysis.activeJointId ? analysis.joints[analysis.activeJointId] : null;
  const outOfPlane = active?.tracked && active.outOfPlane;

  return (
    <View style={styles.root}>
      <MediapipeCamera
        style={StyleSheet.absoluteFill}
        solution={solution}
        activeCamera={cameraPosition}
        resizeMode="cover"
      />
      <SkeletonOverlay landmarks={landmarks} analysis={analysis} compensations={compensations} />

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
        <View pointerEvents="box-none" style={styles.topRow}>
          {landmarks ? <HeroReadout analysis={analysis} /> : <View />}
          <View style={styles.status}>
            <Text style={styles.statusText}>{state.fps} FPS</Text>
            <Text style={styles.statusMuted}>🔒 Analyse locale</Text>
          </View>
        </View>

        <View pointerEvents="none" style={styles.alerts}>
          {state.error && <AlertBanner tone="danger" message={`Erreur détection : ${state.error}`} />}
          {compensations.map((c) => (
            <AlertBanner
              key={c.kind}
              tone="danger"
              message={`${c.message} (${Math.round(c.deviationDeg)}°)`}
            />
          ))}
          {outOfPlane && active && (
            <AlertBanner
              tone="warning"
              message={`${JOINTS_BY_ID[active.id].label} hors du plan caméra : placez la tablette face au mouvement`}
            />
          )}
          {!landmarks && !state.error && (
            <AlertBanner tone="info" message="Placez le patient en entier dans le cadre (≈ 2 m)" />
          )}
          {landmarks && !state.calibrated && (
            <AlertBanner tone="info" message="Calibrage de la posture… restez immobile" />
          )}
        </View>

        <View
          pointerEvents="box-none"
          style={[styles.bottom, landscape ? styles.bottomLandscape : styles.bottomPortrait]}
        >
          <JointCards analysis={analysis} onSelect={setFocus} direction="row" />
          <View style={styles.actions}>
            <BigButton
              label="↺ Nouvelle mesure"
              variant="primary"
              onPress={restart}
              accessibilityHint="Remet à zéro les amplitudes et recalibre la posture"
            />
            <BigButton
              label="⇄ Caméra"
              onPress={() => setCameraPosition((p) => (p === 'back' ? 'front' : 'back'))}
              accessibilityHint="Bascule entre caméra arrière et frontale"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hud: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  status: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-end',
  },
  statusText: { color: colors.text, fontSize: font.body, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statusMuted: { color: colors.textMuted, fontSize: font.caption },
  alerts: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  bottom: { gap: spacing.md },
  bottomLandscape: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bottomPortrait: { flexDirection: 'column', alignItems: 'stretch' },
  actions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
});
