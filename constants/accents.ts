export type AccentName = 'Violeta' | 'Azul' | 'Verde' | 'Laranja' | 'Rosa';

/** As 4 cores da família "primary" que definem o destaque do app. */
export interface AccentColors {
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
}

export const ACCENTS: Record<
  AccentName,
  { light: AccentColors; dark: AccentColors }
> = {
  Violeta: {
    dark: {
      primary: '#d2bbff',
      primaryContainer: '#7c3aed',
      onPrimary: '#3f008e',
      onPrimaryContainer: '#ede0ff',
    },
    light: {
      primary: '#6d28d9',
      primaryContainer: '#7c3aed',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#ede0ff',
    },
  },
  Azul: {
    dark: {
      primary: '#aac7ff',
      primaryContainer: '#2563eb',
      onPrimary: '#002e69',
      onPrimaryContainer: '#d8e2ff',
    },
    light: {
      primary: '#1d4ed8',
      primaryContainer: '#2563eb',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#d8e2ff',
    },
  },
  Verde: {
    dark: {
      primary: '#7ddb9a',
      primaryContainer: '#059669',
      onPrimary: '#00391c',
      onPrimaryContainer: '#c8f0d4',
    },
    light: {
      primary: '#047857',
      primaryContainer: '#059669',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#c8f0d4',
    },
  },
  Laranja: {
    dark: {
      primary: '#ffb68a',
      primaryContainer: '#d97706',
      onPrimary: '#4a2400',
      onPrimaryContainer: '#ffe0cc',
    },
    light: {
      primary: '#c2410c',
      primaryContainer: '#d97706',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#ffe0cc',
    },
  },
  Rosa: {
    dark: {
      primary: '#ffb0cd',
      primaryContainer: '#db2777',
      onPrimary: '#5a0a35',
      onPrimaryContainer: '#ffd9e6',
    },
    light: {
      primary: '#db2777',
      primaryContainer: '#db2777',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#ffd9e6',
    },
  },
};

/** Converte "#rrggbb" em "r g b" (formato usado pelas variáveis CSS do NativeWind). */
export function hexToTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function resolveAccent(name: string): { light: AccentColors; dark: AccentColors } {
  return ACCENTS[name as AccentName] ?? ACCENTS.Violeta;
}
