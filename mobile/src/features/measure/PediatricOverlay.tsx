import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import {
  JOINTS_BY_ID,
  progressToward,
  targetPoint,
  type JointAnalysis,
  type ScreenLandmark,
} from '../../core';
import { colors, radius, spacing } from '../../ui/theme';

interface PediatricOverlayProps {
  analysis: JointAnalysis;
  landmarks: ScreenLandmark[] | null;
  /** Amplitude visée pour l'articulation active (°). */
  targetValue: number | null;
}

const REWARDS = ['⭐', '🌟', '🏆', '🦄', '🚀', '🎈'];

/**
 * Mode pédiatrie : une étoile à attraper matérialise l'amplitude à atteindre,
 * une fusée monte avec le mouvement et chaque réussite fait gagner un badge.
 */
export function PediatricOverlay({ analysis, landmarks, targetValue }: PediatricOverlayProps) {
  const [stars, setStars] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const armed = useRef(true);

  const id = analysis.activeJointId;
  const m = id ? analysis.joints[id] : null;
  const def = id ? JOINTS_BY_ID[id] : null;
  const start = m?.min ?? 0;
  const progress = m?.value != null && targetValue !== null ? progressToward(m.value, start, targetValue) : 0;

  useEffect(() => {
    if (progress >= 1 && armed.current) {
      armed.current = false;
      setStars((s) => s + 1);
      setCelebrating(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const t = setTimeout(() => setCelebrating(false), 1200);
      return () => clearTimeout(t);
    }
    // Il faut revenir au départ pour gagner l'étoile suivante.
    if (progress < 0.3) armed.current = true;
  }, [progress]);

  let target: { x: number; y: number } | null = null;
  if (def && landmarks && targetValue !== null && m?.tracked) {
    target = targetPoint(def, landmarks[def.proximal], landmarks[def.vertex], landmarks[def.distal], targetValue);
  }
  const tip = def && landmarks && m?.tracked ? landmarks[def.distal] : null;

  return (
    <>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {target && tip && (
          <>
            <Line x1={tip.x} y1={tip.y} x2={target.x} y2={target.y} stroke="#FDE047" strokeWidth={4} strokeDasharray="4 10" strokeLinecap="round" />
            <Circle cx={target.x} cy={target.y} r={52} fill="#FDE047" fillOpacity={0.25} stroke="#FDE047" strokeWidth={4} />
            <SvgText x={target.x} y={target.y + 22} fontSize={64} textAnchor="middle">
              {progress >= 1 ? '🌟' : '⭐'}
            </SvgText>
          </>
        )}
      </Svg>

      <View pointerEvents="none" style={styles.rocketTrack}>
        <View style={[styles.rocketFill, { height: `${Math.round(progress * 100)}%` }]} />
        <Text style={[styles.rocket, { bottom: `${Math.round(progress * 85)}%` }]}>🚀</Text>
      </View>

      <View pointerEvents="none" style={styles.score}>
        <Text style={styles.scoreText}>{stars > 0 ? REWARDS.slice(0, Math.min(stars, 6)).join(' ') : 'Attrape l’étoile !'}</Text>
        {stars > 6 && <Text style={styles.scoreText}>× {stars}</Text>}
      </View>

      {celebrating && (
        <View pointerEvents="none" style={styles.celebration}>
          <Text style={styles.celebrationText}>🎉 Bravo ! 🎉</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  rocketTrack: {
    position: 'absolute',
    right: spacing.lg,
    top: '22%',
    bottom: '30%',
    width: 56,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'visible',
    justifyContent: 'flex-end',
  },
  rocketFill: { backgroundColor: '#FDE047', borderRadius: radius.pill, width: '100%' },
  rocket: { position: 'absolute', left: 4, fontSize: 44 },
  score: {
    position: 'absolute',
    alignSelf: 'center',
    top: '14%',
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scoreText: { color: '#fff', fontSize: 30, fontWeight: '900' },
  celebration: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  celebrationText: { fontSize: 88, fontWeight: '900', color: '#FDE047', textShadowColor: '#000', textShadowRadius: 12 },
});
