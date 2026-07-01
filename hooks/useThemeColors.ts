import { useColorScheme } from 'nativewind';
import {
  DARK_COLORS,
  LIGHT_COLORS,
  type ThemePalette,
} from '@/constants/theme';
import { resolveAccent } from '@/constants/accents';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * Retorna a paleta ativa (clara/escura) já com a COR DE DESTAQUE aplicada,
 * para uso em props que recebem cor direta (ícones, SVG, Switch, tab bar) —
 * onde não dá para usar className.
 */
export function useThemeColors(): ThemePalette {
  const { colorScheme } = useColorScheme();
  const { settings } = useSettings();

  const isLight = colorScheme === 'light';
  const base = isLight ? LIGHT_COLORS : DARK_COLORS;
  const accent = resolveAccent(settings.accent);
  const a = isLight ? accent.light : accent.dark;

  return {
    ...base,
    primary: a.primary,
    primaryContainer: a.primaryContainer,
    onPrimary: a.onPrimary,
    onPrimaryContainer: a.onPrimaryContainer,
  };
}
