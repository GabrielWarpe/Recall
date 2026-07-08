import React from 'react';
import { View, Platform, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  /**
   * Nível de destaque:
   * - 'flat': superfície base, sem sombra (blocos secundários agrupados).
   * - 'raised' (padrão): superfície elevada com sombra suave — a hierarquia
   *   passa a vir de profundidade, não da antiga borda cinza.
   */
  level?: 'flat' | 'raised';
  className?: string;
}

// Sombra sutil (quase imperceptível sobre o fundo escuro, mas separa o card do
// plano). No iOS via shadow*, no Android via elevation. Exportada para outros
// componentes clicáveis (ex.: DeckCard) reusarem a MESMA elevação.
export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  android: { elevation: 3 },
  default: {},
});

const RAISED = cardShadow;

/** Superfície padrão do app: fundo surface-container + cantos do tema. */
export function Card({
  level = 'raised',
  className,
  style,
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={`bg-surface-container rounded-card ${className ?? ''}`}
      style={[level === 'raised' ? RAISED : null, style]}
      {...props}
    >
      {children}
    </View>
  );
}
