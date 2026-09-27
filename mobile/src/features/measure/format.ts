import { JOINTS_BY_ID, type JointMeasurement } from '../../core';
import { colors } from '../../ui/theme';

export function formatDegrees(value: number | null): string {
  return value === null ? '--' : `${Math.round(value)}`;
}

/** Couleur d'une mesure : hors plan (orange) > active (vert) > suivie (cyan). */
export function measurementColor(m: JointMeasurement, isActive: boolean): string {
  if (!m.tracked) return colors.textMuted;
  if (m.outOfPlane) return colors.warning;
  return isActive ? colors.active : colors.primary;
}

/** Pourcentage de l'amplitude de référence atteint par le pic de flexion. */
export function referencePercent(m: JointMeasurement): number | null {
  if (m.peakFlexion === null) return null;
  return Math.round((m.peakFlexion / JOINTS_BY_ID[m.id].referenceFlexion) * 100);
}
