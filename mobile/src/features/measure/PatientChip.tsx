import { Pressable, StyleSheet, Text } from 'react-native';

import { ageAt, localDate } from '../../core';
import { useAppStore } from '../../data/AppStore';
import { useNavigate } from '../../navigation';
import { colors, font, radius, spacing, TOUCH_TARGET } from '../../ui/theme';

export function PatientChip() {
  const { currentPatient } = useAppStore();
  const navigate = useNavigate();
  const label = currentPatient
    ? `${currentPatient.lastName.toUpperCase()} ${currentPatient.firstName} · ${ageAt(currentPatient.birthDate, localDate(new Date()))} ans`
    : 'Choisir un patient';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Patient : ${label}. Changer de patient`}
      onPress={() => navigate('patients')}
      style={({ pressed }) => [styles.chip, !currentPatient && styles.missing, pressed && styles.pressed]}
    >
      <Text style={[styles.text, !currentPatient && styles.missingText]} numberOfLines={1}>
        👤 {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET - 16,
    maxWidth: 380,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  missing: { backgroundColor: colors.warning, borderColor: colors.warning },
  pressed: { opacity: 0.7 },
  text: { color: colors.text, fontSize: font.caption + 1, fontWeight: '700' },
  missingText: { color: colors.background },
});
