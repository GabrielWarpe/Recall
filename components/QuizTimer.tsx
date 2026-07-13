import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TIMER_TICK_MS } from '@/constants/study';
import { formatClock } from '@/utils/stats';
import { useThemeColors } from '@/hooks/useThemeColors';

interface QuizTimerProps {
  /** Lê o tempo ativo corrente (de `useStudySession`). Deve ser estável. */
  getElapsed: () => number;
  /** Enquanto true, o relógio corre. */
  running: boolean;
}

/**
 * Relógio do quiz. Existe como componente PRÓPRIO de propósito: o tique de 1s
 * mora aqui, então só este texto re-renderiza. Se o estado do tempo vivesse na
 * tela, ela redesenharia a cada segundo e arrastaria a pergunta junto — e o
 * QuizQuestion tem guards anti-toque-duplo e animação de opacidade que não
 * devem ser perturbados a cada segundo.
 */
export function QuizTimer({ getElapsed, running }: QuizTimerProps) {
  const colors = useThemeColors();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    setSeconds(getElapsed());
    const id = setInterval(() => setSeconds(getElapsed()), TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [running, getElapsed]);

  return (
    <View className="flex-row items-center gap-1">
      <Ionicons name="time-outline" size={13} color={colors.outline} />
      <Text
        className="text-outline font-inter-medium text-xs"
        // Largura tabular: o relógio não "dança" quando os dígitos mudam.
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {formatClock(seconds)}
      </Text>
    </View>
  );
}
