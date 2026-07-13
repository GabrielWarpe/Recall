import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

/** Texto padrão — o card em tela ainda vale; só depois dele a sessão encerra. */
export const TIME_UP_MESSAGE =
  'Tempo esgotado — conclua este card para ver o resultado.';

interface TimeUpNoticeProps {
  message?: string;
  className?: string;
}

/**
 * Aviso de tempo esgotado (modo regressivo). Não bloqueia nada: o card em tela
 * continua respondível, e é justamente por isso que o encerramento não é
 * abrupto. Usado pelos três modos de estudo.
 */
export function TimeUpNotice({
  message = TIME_UP_MESSAGE,
  className = '',
}: TimeUpNoticeProps) {
  const colors = useThemeColors();

  return (
    <View
      className={`flex-row items-center gap-2 rounded-card px-4 py-3 ${className}`}
      style={{ backgroundColor: colors.error + '1F' }}
    >
      <Ionicons name="alarm-outline" size={18} color={colors.error} />
      <Text
        className="flex-1 font-inter-semibold text-sm"
        style={{ color: colors.error }}
      >
        {message}
      </Text>
    </View>
  );
}
