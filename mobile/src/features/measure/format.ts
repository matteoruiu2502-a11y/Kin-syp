import { JOINTS_BY_ID, type JointId, type JointMeasurement } from '../../core';
import { colors } from '../../ui/theme';

export function formatDegrees(value: number | null): string {
  return value === null ? '--' : `${Math.round(value)}`;
}

/** Valeur affichée : signe explicite pour la cheville (flexion dorsale / plantaire). */
export function formatJointValue(id: JointId, value: number | null): string {
  if (value === null) return '--';
  const v = Math.round(value);
  return JOINTS_BY_ID[id].convention === 'dorsiflexion' && v > 0 ? `+${v}` : `${v}`;
}

/** Couleur d'une mesure : hors plan (orange) > active (vert) > suivie (cyan). */
export function measurementColor(m: JointMeasurement, isActive: boolean): string {
  if (!m.tracked) return colors.textMuted;
  if (m.outOfPlane) return colors.warning;
  return isActive ? colors.active : colors.primary;
}
