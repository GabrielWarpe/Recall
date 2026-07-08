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
  success: string;
  warning: string;
  info: string;
};

// Meia-noite (escuro): índigo-tinta + petróleo-teal. Espelha global.css —
// esta cópia em objeto JS alimenta o useThemeColors (props de cor diretas:
// ícones, tab bar, SVG), então precisa bater com as variáveis CSS.
export const DARK_COLORS: ThemePalette = {
  background: '#0b0f14',
  surface: '#0b0f14',
  surfaceContainer: '#121821',
  surfaceContainerHigh: '#1a222e',
  surfaceContainerHighest: '#26303e',
  surfaceContainerLow: '#0f141b',
  surfaceBright: '#2e3947',
  primary: '#56d2c6',
  primaryContainer: '#178c87',
  onPrimary: '#04302c',
  onPrimaryContainer: '#dffbf7',
  secondary: '#aeb9c4',
  secondaryContainer: '#26303e',
  tertiary: '#e6a94d',
  tertiaryContainer: '#7a5216',
  onSurface: '#eaf1f5',
  onSurfaceVariant: '#aeb9c4',
  outlineVariant: '#313b47',
  outline: '#7e8a96',
  error: '#e5756b',
  success: '#4fb980',
  warning: '#e0a63e',
  info: '#5aa6e8',
};

// Meia-noite (claro): papel frio.
export const LIGHT_COLORS: ThemePalette = {
  background: '#f4f6f8',
  surface: '#f4f6f8',
  surfaceContainer: '#ffffff',
  surfaceContainerHigh: '#ecf0f3',
  surfaceContainerHighest: '#e2e7ec',
  surfaceContainerLow: '#f9fafc',
  surfaceBright: '#ffffff',
  primary: '#0e6e69',
  primaryContainer: '#178c87',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#dffbf7',
  secondary: '#4a525a',
  secondaryContainer: '#dae2e6',
  tertiary: '#a86a16',
  tertiaryContainer: '#f5d5a5',
  onSurface: '#181e26',
  onSurfaceVariant: '#4a545e',
  outlineVariant: '#cdd5dc',
  outline: '#76808a',
  error: '#c0392f',
  success: '#228b5c',
  warning: '#b07a20',
  info: '#2874be',
};

/** Palette padrão (escura) — mantida para compatibilidade com imports existentes. */
export const COLORS = DARK_COLORS;

// Cores de deck refinadas para harmonizar com a Meia-noite: tons de joia
// levemente dessaturados que ficam bem como tinta de avatar sobre o índigo.
export const DECK_COLORS = [
  '#2fb3a6', // teal
  '#4aa3e0', // azul
  '#7e8ce8', // índigo
  '#a98be2', // violeta
  '#5fb187', // verde
  '#e2a64e', // âmbar
  '#e37e8c', // rosa
  '#e07658', // coral
  '#8a94a6', // ardósia
  '#e6e9ee', // névoa
];

// Cores antigas → novas, casadas por FAMÍLIA de cor. Assim decks já criados
// harmonizam na hora (identidade preservada) sem alterar o dado salvo.
const LEGACY_DECK_COLORS: Record<string, string> = {
  '#7c3aed': '#a98be2', // violeta
  '#6d28d9': '#7e8ce8', // índigo
  '#2563eb': '#4aa3e0', // azul
  '#0891b2': '#2fb3a6', // ciano → teal
  '#059669': '#5fb187', // verde
  '#d97706': '#e2a64e', // âmbar
  '#dc2626': '#e07658', // vermelho → coral
  '#db2777': '#e37e8c', // rosa
  '#000000': '#8a94a6', // preto → ardósia (invisível como tinta no escuro)
  '#ffffff': '#e6e9ee', // branco → névoa
};

/** Cor de exibição de um deck: remapeia hexes da paleta antiga para a nova
 * (puramente visual). Cores fora do mapa passam direto. */
export function resolveDeckColor(color: string): string {
  return LEGACY_DECK_COLORS[color.toLowerCase()] ?? color;
}
