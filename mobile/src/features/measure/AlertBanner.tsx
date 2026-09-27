import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '../../ui/theme';

interface AlertBannerProps {
  tone: 'danger' | 'warning' | 'info';
  message: string;
}

export function AlertBanner({ tone, message }: AlertBannerProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        tone === 'danger' && styles.danger,
        tone === 'warning' && styles.warning,
      ]}
    >
      <Text style={[styles.text, tone === 'warning' && styles.textDark]}>
        {tone === 'info' ? '' : '⚠ '}
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'center',
  },
  danger: { backgroundColor: colors.dangerSurface },
  warning: { backgroundColor: colors.warning },
  text: { color: colors.text, fontSize: font.title, fontWeight: '800', textAlign: 'center' },
  textDark: { color: colors.background },
});
