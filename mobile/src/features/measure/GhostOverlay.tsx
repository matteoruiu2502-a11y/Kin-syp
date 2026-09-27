import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import {
  SKELETON_CONNECTIONS,
  SKELETON_POINTS,
  ghostFrameAt,
  projectGhost,
  type GhostTrack,
  type ScreenLandmark,
} from '../../core';

const GHOST_COLOR = '#C4B5FD';
const MIN_VIS = 0.5;

/**
 * Mode fantôme : le squelette d'une séance précédente est rejoué en boucle,
 * en transparence, recalé sur le patient en direct pour comparer avant/après.
 */
export function GhostOverlay({ track, live }: { track: GhostTrack; live: ScreenLandmark[] | null }) {
  const { width, height } = useWindowDimensions();
  const startRef = useRef(Date.now());
  const [, setTick] = useState(0);

  // Horloge propre (15 i/s) : le fantôme bouge même si le patient sort du cadre.
  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setTick((t) => t + 1), 66);
    return () => clearInterval(id);
  }, [track]);

  const frame = ghostFrameAt(track, Date.now() - startRef.current);
  const pts = projectGhost(frame, live, { width, height });
  const ok = (i: number) => (pts[i]?.visibility ?? 0) >= MIN_VIS;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" opacity={0.55}>
      {SKELETON_CONNECTIONS.map(([i, j]) =>
        ok(i) && ok(j) ? (
          <Line
            key={`g${i}-${j}`}
            x1={pts[i].x}
            y1={pts[i].y}
            x2={pts[j].x}
            y2={pts[j].y}
            stroke={GHOST_COLOR}
            strokeWidth={10}
            strokeLinecap="round"
          />
        ) : null,
      )}
      {SKELETON_POINTS.map((i) => (ok(i) ? <Circle key={`gp${i}`} cx={pts[i].x} cy={pts[i].y} r={9} fill={GHOST_COLOR} /> : null))}
    </Svg>
  );
}
