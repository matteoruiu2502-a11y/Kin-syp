import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import {
  JOINTS,
  SKELETON_CONNECTIONS,
  SKELETON_POINTS,
  type Compensation,
  type JointAnalysis,
  type Point2,
  type ScreenLandmark,
} from '../../core';
import { colors } from '../../ui/theme';
import { formatDegrees, measurementColor } from './format';

const MIN_VISIBILITY = 0.5;
const ARC_RADIUS = 42;

interface SkeletonOverlayProps {
  landmarks: ScreenLandmark[] | null;
  analysis: JointAnalysis;
  compensations: Compensation[];
}

/** Arc SVG au sommet `b` couvrant l'angle intérieur entre b→a et b→c. */
function arcPath(a: Point2, b: Point2, c: Point2, r: number): string | null {
  const n1 = Math.hypot(a.x - b.x, a.y - b.y);
  const n2 = Math.hypot(c.x - b.x, c.y - b.y);
  if (n1 === 0 || n2 === 0) return null;
  const u1 = { x: (a.x - b.x) / n1, y: (a.y - b.y) / n1 };
  const u2 = { x: (c.x - b.x) / n2, y: (c.y - b.y) / n2 };
  const sweep = u1.x * u2.y - u1.y * u2.x > 0 ? 1 : 0;
  const start = { x: b.x + r * u1.x, y: b.y + r * u1.y };
  const end = { x: b.x + r * u2.x, y: b.y + r * u2.y };
  return `M ${b.x} ${b.y} L ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweep} ${end.x} ${end.y} Z`;
}

/** Point milieu de la bissectrice extérieure, pour placer l'étiquette hors du membre. */
function labelPosition(a: Point2, b: Point2, c: Point2, offset: number): Point2 {
  const n1 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  const n2 = Math.hypot(c.x - b.x, c.y - b.y) || 1;
  const bx = (a.x - b.x) / n1 + (c.x - b.x) / n2;
  const by = (a.y - b.y) / n1 + (c.y - b.y) / n2;
  const nb = Math.hypot(bx, by);
  // Membre tendu : bissectrice indéfinie, on décale perpendiculairement.
  const dir = nb < 1e-3 ? { x: -(a.y - b.y) / n1, y: (a.x - b.x) / n1 } : { x: -bx / nb, y: -by / nb };
  return { x: b.x + dir.x * offset, y: b.y + dir.y * offset };
}

function SkeletonOverlayImpl({ landmarks, analysis, compensations }: SkeletonOverlayProps) {
  if (!landmarks) return null;
  const visible = (i: number) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY;
  const flagged = new Set(compensations.flatMap((c) => c.landmarks));

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {SKELETON_CONNECTIONS.map(([i, j]) =>
        visible(i) && visible(j) ? (
          <Line
            key={`l${i}-${j}`}
            x1={landmarks[i].x}
            y1={landmarks[i].y}
            x2={landmarks[j].x}
            y2={landmarks[j].y}
            stroke={flagged.has(i) && flagged.has(j) ? colors.danger : colors.skeleton}
            strokeWidth={flagged.has(i) && flagged.has(j) ? 6 : 4}
            strokeLinecap="round"
          />
        ) : null,
      )}

      {SKELETON_POINTS.map((i) =>
        visible(i) ? (
          <Circle key={`p${i}`} cx={landmarks[i].x} cy={landmarks[i].y} r={6} fill={colors.text} />
        ) : null,
      )}

      {JOINTS.map((def) => {
        const m = analysis.joints[def.id];
        if (!m.tracked || m.flexion === null) return null;
        const a = landmarks[def.proximal];
        const b = landmarks[def.vertex];
        const c = landmarks[def.distal];
        const isActive = analysis.activeJointId === def.id;
        const color = measurementColor(m, isActive);
        const arc = arcPath(a, b, c, ARC_RADIUS);
        const label = labelPosition(a, b, c, ARC_RADIUS + 34);
        return (
          <G key={def.id}>
            {arc && <Path d={arc} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={3} />}
            <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={7} strokeLinecap="round" />
            <Line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke={color} strokeWidth={7} strokeLinecap="round" />
            <Circle cx={b.x} cy={b.y} r={10} fill={color} stroke={colors.background} strokeWidth={3} />
            <SvgText
              x={label.x}
              y={label.y + 12}
              fontSize={isActive ? 40 : 30}
              fontWeight="800"
              fill={color}
              stroke={colors.background}
              strokeWidth={1.5}
              textAnchor="middle"
            >
              {`${formatDegrees(m.flexion)}°`}
            </SvgText>
          </G>
        );
      })}

      {/* Entourage rouge des zones de compensation. */}
      {compensations.map((comp) =>
        comp.landmarks
          .filter(visible)
          .map((i) => (
            <Circle
              key={`c-${comp.kind}-${i}`}
              cx={landmarks[i].x}
              cy={landmarks[i].y}
              r={40}
              stroke={colors.danger}
              strokeWidth={6}
              fill={colors.danger}
              fillOpacity={0.15}
            />
          )),
      )}
    </Svg>
  );
}

export const SkeletonOverlay = memo(SkeletonOverlayImpl);
