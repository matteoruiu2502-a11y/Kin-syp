import { StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { PoseLandmark as L, type PostureAnalysis, type ScreenLandmark } from '../../core';
import { colors } from '../../ui/theme';

/** Fil à plomb et lignes des ceintures scapulaire / pelvienne, colorées selon l'alignement. */
export function PostureOverlay({ posture, landmarks }: { posture: PostureAnalysis | null; landmarks: ScreenLandmark[] | null }) {
  if (!posture || !landmarks) return null;
  const status = (key: string) => posture.metrics.find((m) => m.key === key)?.status;
  const color = (key: string) => (status(key) === 'warn' ? colors.warning : colors.active);

  const extend = (a: ScreenLandmark, b: ScreenLandmark, k = 0.35) => ({
    x1: a.x + (a.x - b.x) * k,
    y1: a.y + (a.y - b.y) * k,
    x2: b.x + (b.x - a.x) * k,
    y2: b.y + (b.y - a.y) * k,
  });

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {posture.plumbLine && (
        <Line
          x1={posture.plumbLine.top.x}
          y1={posture.plumbLine.top.y - 40}
          x2={posture.plumbLine.bottom.x}
          y2={posture.plumbLine.bottom.y + 20}
          stroke={colors.primary}
          strokeWidth={3}
          strokeDasharray="10 8"
        />
      )}
      {posture.view === 'front' && (
        <>
          <Line {...extend(landmarks[L.leftShoulder], landmarks[L.rightShoulder])} stroke={color('shoulders')} strokeWidth={5} />
          <Line {...extend(landmarks[L.leftHip], landmarks[L.rightHip])} stroke={color('pelvis')} strokeWidth={5} />
        </>
      )}
    </Svg>
  );
}
