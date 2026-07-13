import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TIMER_TICK_MS } from '@/constants/study';
import { formatClock } from '@/utils/stats';
import type { StudyTimerPhase } from '@/hooks/useStudyTimer';
import { useThemeColors } from '@/hooks/useThemeColors';

interface SessionTimerProps {
  /** Lê o valor a exibir (decorrido ou restante). Deve ser estável. */
  getDisplay: () => number;
  /** Enquanto true, o relógio corre. */
  running: boolean;
  /** Urgência (só o regressivo sai de 'normal'). */
  phase?: StudyTimerPhase;
  /** Regressivo: acrescenta a ampulheta ao ícone. */
  countdown?: boolean;
}

/**
 * Relógio da sessão. Existe como componente PRÓPRIO de propósito: o tique de 1s
 * mora aqui, então só este texto re-renderiza. Se o estado do tempo vivesse na
 * tela, ela redesenharia a cada segundo e arrastaria a pergunta junto — e o
 * QuizQuestion tem guards anti-toque-duplo e animação de opacidade que não
 * devem ser perturbados a cada segundo.
 */
export function SessionTimer({
  getDisplay,
  running,
  phase = 'normal',
  countdown = false,
}: SessionTimerProps) {
  const colors = useThemeColors();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    setSeconds(getDisplay());
    const id = setInterval(() => setSeconds(getDisplay()), TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [running, getDisplay]);

  const tint =
    phase === 'danger'
      ? colors.error
      : phase === 'warn'
        ? colors.tertiary
        : colors.outline;

  return (
    <View className="flex-row items-center gap-1">
      <Ionicons
        name={countdown ? 'hourglass-outline' : 'time-outline'}
        size={13}
        color={tint}
      />
      <Text
        className={`text-xs ${phase === 'normal' ? 'font-inter-medium' : 'font-inter-semibold'}`}
        // Largura tabular: o relógio não "dança" quando os dígitos mudam.
        style={{ color: tint, fontVariant: ['tabular-nums'] }}
      >
        {formatClock(seconds)}
      </Text>
    </View>
  );
}
