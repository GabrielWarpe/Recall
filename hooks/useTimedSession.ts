import { useCallback, useEffect, useState } from 'react';
import type { Flashcard, StudyTimerConfig } from '@/types';
import { clampTimerLimit } from '@/constants/study';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useSettings } from '@/contexts/SettingsContext';

interface TimedSessionTarget {
  phase: string;
  getElapsed: () => number;
  start: (cards: Flashcard[]) => void;
  requestFinish: () => void;
  reset: () => void;
}

/**
 * Junta o cronômetro à sessão de estudo — igual para TODOS os modos
 * (flashcards, alternado, quiz, escrever). Cada tela, em vez de chamar
 * `session.start(cards)` direto, chama `prepare(cards)`: os cards ficam
 * pendentes e a tela de início (`StudySetup`) decide quando começar.
 *
 * A config nasce do padrão salvo na conta e pode ser alterada na tela de
 * início SEM tocar na preferência — é o "só nesta sessão".
 */
export function useTimedSession(session: TimedSessionTarget) {
  const { settings } = useSettings();
  const [pending, setPending] = useState<Flashcard[] | null>(null);
  const [started, setStarted] = useState(false);

  const fromSettings = useCallback(
    (): StudyTimerConfig => ({
      enabled: settings.studyTimer,
      mode: settings.studyTimerMode,
      limitSeconds: clampTimerLimit(settings.studyTimerMinutes) * 60,
      visible: settings.studyTimerVisible,
      scope: 'session',
    }),
    [
      settings.studyTimer,
      settings.studyTimerMode,
      settings.studyTimerMinutes,
      settings.studyTimerVisible,
    ],
  );

  const [config, setConfig] = useState<StudyTimerConfig>(fromSettings);

  // As preferências chegam do banco DEPOIS do primeiro render (o provider abre
  // pelo cache local): re-sincroniza enquanto o usuário ainda não começou —
  // depois de começar, a config é dele, não das preferências.
  useEffect(() => {
    if (started) return;
    setConfig(fromSettings());
  }, [started, fromSettings]);

  const timer = useStudyTimer({
    config,
    getElapsed: session.getElapsed,
    running: session.phase === 'studying',
    // Tempo esgotado: nada é arrancado da mão — a sessão encerra assim que o
    // card em tela for resolvido (respondido, avaliado ou pulado).
    onExpire: useCallback(() => session.requestFinish(), [session]),
  });

  /** Cards prontos; aguarda o "Começar" da tela de início. */
  const prepare = useCallback((cards: Flashcard[]) => setPending(cards), []);

  const begin = useCallback(() => {
    if (!pending) return;
    timer.reset();
    session.start(pending);
    setStarted(true);
  }, [pending, session, timer]);

  const resetTimed = useCallback(() => {
    setPending(null);
    setStarted(false);
    timer.reset();
    session.reset();
  }, [session, timer]);

  return {
    /** Cards aguardando confirmação (null = ainda não montados). */
    pending,
    /** true depois que o usuário tocou em "Começar". */
    started,
    prepare,
    begin,
    /** Zera sessão + cronômetro + pendência (para "refazer"). */
    resetTimed,
    config,
    setConfig,
    /** Mostrar a tela de início? */
    showSetup: pending != null && !started,
    /** Mostrar o relógio? (desligado ou oculto → não) */
    showClock: config.enabled && config.visible,
    /** Tempo esgotado no regressivo. */
    expired: timer.expired,
    getDisplay: timer.getDisplay,
    phase: timer.phase,
    isCountdown: timer.isCountdown,
  };
}
