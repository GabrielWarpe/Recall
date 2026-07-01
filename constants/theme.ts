export type ThemePalette = {
  background: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceContainerLow: string;
  surfaceBright: string;
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  outline: string;
  error: string;
};

export const DARK_COLORS: ThemePalette = {
  background: '#0b1326',
  surface: '#0b1326',
  surfaceContainer: '#171f33',
  surfaceContainerHigh: '#222a3d',
  surfaceContainerHighest: '#2d3449',
  surfaceContainerLow: '#131b2e',
  surfaceBright: '#31394d',
  primary: '#d2bbff',
  primaryContainer: '#7c3aed',
  onPrimary: '#3f008e',
  onPrimaryContainer: '#ede0ff',
  secondary: '#c7c4d8',
  secondaryContainer: '#494758',
  tertiary: '#ffb690',
  tertiaryContainer: '#aa4900',
  onSurface: '#dae2fd',
  onSurfaceVariant: '#ccc3d8',
  outlineVariant: '#4a4455',
  outline: '#958da1',
  error: '#ffb4ab',
};

export const LIGHT_COLORS: ThemePalette = {
  background: '#f7f5fc',
  surface: '#f7f5fc',
  surfaceContainer: '#eee9f7',
  surfaceContainerHigh: '#e7e0f3',
  surfaceContainerHighest: '#e0d8ee',
  surfaceContainerLow: '#f3effa',
  surfaceBright: '#fdfbff',
  primary: '#6d28d9',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ede0ff',
  secondary: '#4a4458',
  secondaryContainer: '#e2dff0',
  tertiary: '#9a4600',
  tertiaryContainer: '#ffb690',
  onSurface: '#1c1b22',
  onSurfaceVariant: '#49454e',
  outlineVariant: '#cac4d4',
  outline: '#79747e',
  error: '#ba1a1a',
};

/** Palette padrão (escura) — mantida para compatibilidade com imports existentes. */
export const COLORS = DARK_COLORS;

export const DECK_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#db2777',
  '#6d28d9',
];

export const DECK_EMOJIS = [
  '📚', '🧠', '⚡', '🎯', '🔬', '🌍',
  '💻', '🎨', '📐', '🏛️', '🎵', '🌱',
];
