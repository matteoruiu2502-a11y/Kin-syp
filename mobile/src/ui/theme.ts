/**
 * Thème "cabinet" : fond sombre pour faire ressortir la vidéo, contrastes
 * élevés et typographie XXL lisible à 2 m d'une tablette sur trépied.
 */
export const colors = {
  background: '#0B1220',
  surface: 'rgba(11, 18, 32, 0.78)',
  surfaceStrong: 'rgba(11, 18, 32, 0.92)',
  border: 'rgba(255, 255, 255, 0.14)',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  primary: '#22D3EE',
  active: '#A3E635',
  warning: '#FBBF24',
  danger: '#EF4444',
  dangerSurface: 'rgba(185, 28, 28, 0.92)',
  skeleton: 'rgba(255, 255, 255, 0.75)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { md: 14, lg: 22, pill: 999 } as const;

export const font = {
  hero: 132,
  heroUnit: 56,
  title: 28,
  body: 20,
  caption: 16,
} as const;

/** Taille minimale d'une cible tactile (utilisable ganté / d'une main). */
export const TOUCH_TARGET = 72;
