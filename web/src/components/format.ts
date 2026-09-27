import { JOINTS_BY_ID, type JointId, type JointMeasurement } from '@core';

export function fmtJoint(id: JointId, value: number | null): string {
  if (value === null) return '--';
  const v = Math.round(value);
  return JOINTS_BY_ID[id].convention === 'dorsiflexion' && v > 0 ? `+${v}` : `${v}`;
}

/** Classe CSS d'état : hors plan > active > suivie > perdue. */
export function jointTone(m: JointMeasurement, active: boolean): 'lost' | 'warn' | 'active' | 'tracked' {
  if (!m.tracked) return 'lost';
  if (m.outOfPlane) return 'warn';
  return active ? 'active' : 'tracked';
}
