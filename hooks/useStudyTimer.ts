import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { StudyTimerConfig } from '@/types';
import {
  TIMER_DANGER_SECONDS,
  TIMER_WARN_SECONDS,
  TIMER_TICK_MS,
} from '@/constants/study';
import { useSettings } from '@/contexts/SettingsContext';

/** Urgência do relógio no modo regressivo (no crescente é sempre 'normal'). */
export type StudyTimerPhase = 'normal' | 'warn' | 'danger';

interface UseStudyTimerArgs {
  config: StudyTimerConfig;
  /** Lê o tempo ativo corrido, de `useStudySession` (estável, sem estado). */
  getElapsed: () => number;
  /** Enquanto true, o relógio corre. */
  running: boolean;
  /** Disparado UMA vez, quando o tempo do modo regressivo zera. */
  onExpire: () => void;
}

/**
 * Camada de modo/limite sobre o cronômetro. O tempo bruto continua vindo do
 * `useActiveTimer` (pausa em segundo plano, relógio monotônico) — aqui só se
 * decide o que EXIBIR e quando o tempo acaba.
 *
 * O tique interno NÃO vira estado a cada segundo: `getDisplay` é lido pelo
 * componente do relógio, que tica por conta própria. Aqui só se guarda o que
 * muda raramente (`phase`, `expired`), então a tela re-renderiza umas poucas
 * vezes na sessão inteira, e não 1× por segundo.
 */
export function useStudyTimer({
  config,
  getElapsed,
  running,
  onExpire,
}: UseStudyTimerArgs) {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<StudyTimerPhase>('normal');
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(false);
  const phaseRef = useRef<StudyTimerPhase>('normal');
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const isCountdown = config.enabled && config.mode === 'down';

  /**
   * O número mostrado no relógio: tempo decorrido (crescente) ou restante
   * (regressivo, nunca negativo).
   */
  const getDisplay = useCallback((): number => {
    const elapsed = getElapsed();
    if (!isCountdown) return elapsed;
    return Math.max(0, config.limitSeconds - elapsed);
  }, [getElapsed, isCountdown, config.limitSeconds]);

  // Vigia os limiares e a expiração. Só existe no regressivo — no crescente
  // não há nada para vigiar, e o intervalo nem chega a ser criado.
  useEffect(() => {
    if (!running || !isCountdown) return;

    const check = () => {
      const remaining = Math.max(0, config.limitSeconds - getElapsed());

      const next: StudyTimerPhase =
        remaining <= TIMER_DANGER_SECONDS
          ? 'danger'
          : remaining <= TIMER_WARN_SECONDS
            ? 'warn'
            : 'normal';
      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
        // Háptico só ao ENTRAR num nível de urgência (não a cada segundo).
        if (next !== 'normal' && settings.feedbackSounds) {
          void Haptics.notificationAsync(
            next === 'danger'
              ? Haptics.NotificationFeedbackType.Error
              : Haptics.NotificationFeedbackType.Warning,
          );
        }
      }

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setExpired(true);
        onExpireRef.current();
      }
    };

    check();
    const id = setInterval(check, TIMER_TICK_MS);
    return () => clearInterval(id);
  }, [
    running,
    isCountdown,
    config.limitSeconds,
    getElapsed,
    settings.feedbackSounds,
  ]);

  /** Zera o estado do relógio para uma sessão nova. */
  const reset = useCallback(() => {
    expiredRef.current = false;
    phaseRef.current = 'normal';
    setExpired(false);
    setPhase('normal');
  }, []);

  return { getDisplay, phase, expired, reset, isCountdown };
}
