import { useState, useCallback, useRef } from 'react';
import type { Flashcard, Deck, Grade, StudyPhase, StudyMode } from '@/types';
import { reviewCard } from '@/services/ai';
import { db } from '@/services/database';
import { prefetchCardImages } from '@/services/images';
import {
  fireStreakNotification,
  syncReminders,
} from '@/services/notifications';
import {
  checkAchievements,
  buildAchievementStats,
} from '@/services/achievements';
import { useActiveTimer } from '@/hooks/useActiveTimer';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * Sessão de estudo com fila. Cada card é concluído uma única vez (ao receber
 * Difícil/Bom/Fácil). "De novo" reenfileira o card ao fim da sessão, então ele
 * reaparece — como nos passos de aprendizagem do Anki. As contagens satisfazem
 * sempre: done = correctCount + hardCount (cada conclusão é uma coisa ou outra);
 * againCount conta as repetições e não entra em `done`.
 */
export function useStudySession(deck: Deck | null, mode: StudyMode = 'flash') {
  const { user, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const [phase, setPhase] = useState<StudyPhase>('idle');
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const startTimeRef = useRef<number>(0);
  // Tempo REAL de resolução (pausa em segundo plano). É o que vai para
  // `active_seconds` — o intervalo started_at→ended_at contaria o app
  // minimizado como se fosse estudo.
  const timer = useActiveTimer();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Encerrar assim que o card em tela for resolvido (tempo esgotado no quiz).
  // É um ref, não estado: quem decide é o `grade`/`skip` do MESMO tique, com os
  // contadores já calculados — ler um estado aqui pegaria o valor anterior.
  const endAfterCurrentRef = useRef(false);

  const start = useCallback(
    (studyCards: Flashcard[]) => {
      const ordered = settings.shuffle
        ? [...studyCards].sort(() => Math.random() - 0.5)
        : [...studyCards];
      // Baixa as imagens da sessão de antemão: quando o card chegar ao topo
      // da fila, ela já está no cache do expo-image e aparece na hora.
      prefetchCardImages(ordered);
      setQueue(ordered);
      setTotal(ordered.length);
      setDone(0);
      setCorrectCount(0);
      setHardCount(0);
      setAgainCount(0);
      setPhase('studying');
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      endAfterCurrentRef.current = false;
      timer.start();
    },
    [settings.shuffle, timer],
  );

  /**
   * Pede para encerrar a sessão assim que o card em tela for resolvido. Nada é
   * descartado: o que já foi concluído conta normalmente. Usado quando o tempo
   * do quiz regressivo esgota — a questão aberta não é arrancada da mão.
   */
  const requestFinish = useCallback(() => {
    endAfterCurrentRef.current = true;
  }, []);

  // Encerra a sessão gravando o registro (só se algum card foi concluído).
  const finalize = useCallback(
    (reviewed: number, correct: number, hard: number, again: number) => {
      // Para o cronômetro antes de qualquer await: o tempo é o da resolução,
      // não o da gravação.
      const activeSeconds = timer.stop();
      setElapsedSeconds(activeSeconds);

      if (deck && user && reviewed > 0) {
        const startedAt = new Date(startTimeRef.current).toISOString();
        void (async () => {
          await db.sessions.create({
            user_id: user.id,
            playlist_id: deck.id,
            started_at: startedAt,
            ended_at: new Date().toISOString(),
            cards_reviewed: reviewed,
            correct_count: correct,
            hard_count: hard,
            again_count: again,
            mode,
            active_seconds: activeSeconds,
          });
          await db.decks.touchStudied(deck.id);

          const before = await db.profile.get(user.id);
          const after = await db.profile.updateStreak(user.id);
          await refreshProfile();

          if (
            settings.streakAlert &&
            after &&
            before &&
            after.current_streak > before.current_streak
          ) {
            await fireStreakNotification(after.current_streak);
          }

          // Janela de 2000 sessões: precisa cobrir os maiores limiares das
          // conquistas (500 sessões, 10.000 cards) — 365 era pouco e tornava
          // os degraus altos inalcançáveis.
          const sessions = await db.sessions.getRecent(user.id, 2000);
          const allDecks = await db.decks.getAll(user.id);
          const [leeches, retentionDays] = await Promise.all([
            db.reviews.getLeeches(user.id),
            db.reviews.getRetentionByDay(user.id, 30),
          ]);
          // Leech domado = card que acumulou 4+ "De novo" e hoje está dominado.
          const masteredIds = new Set(
            allDecks.flatMap(d => d.cards.filter(c => c.mastered).map(c => c.id)),
          );
          const leechesTamed = leeches.filter(l =>
            masteredIds.has(l.cardId),
          ).length;
          const retention30 = retentionDays.reduce(
            (acc, day) => ({
              total: acc.total + day.total,
              retained: acc.retained + day.retained,
            }),
            { total: 0, retained: 0 },
          );
          await checkAchievements(
            user.id,
            buildAchievementStats({
              sessions,
              decks: allDecks,
              currentStreak: after?.current_streak ?? 0,
              longestStreak: after?.longest_streak ?? 0,
              leechesTamed,
              retention30,
            }),
          );

          // Reagenda os lembretes com as contagens pós-sessão: cards recém
          // revisados deixam de estar "devidos" nos próximos dias.
          await syncReminders({
            studyReminder: settings.studyReminder,
            reminderTime: settings.reminderTime,
            streakAlert: settings.streakAlert,
            userId: user.id,
          });
        })();
      }
      setPhase('finished');
    },
    [
      deck,
      user,
      mode,
      timer,
      refreshProfile,
      settings.streakAlert,
      settings.studyReminder,
      settings.reminderTime,
    ],
  );

  // Avalia o card do topo da fila e persiste a revisão SM-2.
  const grade = useCallback(
    (g: Grade) => {
      if (!deck || !user) return;
      const card = queue[0];
      if (!card) return;

      const updated = reviewCard(card, g);
      void db.decks.reviewCard(updated);
      void db.reviews.log({
        user_id: user.id,
        card_id: card.id,
        playlist_id: deck.id,
        grade: g,
        interval_before: card.interval,
        interval_after: updated.interval,
      });

      const passed = g !== 'again';
      const rest = queue.slice(1);
      const nextQueue = passed ? rest : [...rest, card];

      const nextCorrect = correctCount + (g === 'good' || g === 'easy' ? 1 : 0);
      const nextHard = hardCount + (g === 'hard' ? 1 : 0);
      const nextAgain = againCount + (g === 'again' ? 1 : 0);
      const nextDone = done + (passed ? 1 : 0);

      setCorrectCount(nextCorrect);
      setHardCount(nextHard);
      setAgainCount(nextAgain);
      setDone(nextDone);
      setQueue(nextQueue);

      // Fila vazia OU tempo esgotado (o card em tela acabou de ser resolvido).
      if (nextQueue.length === 0 || endAfterCurrentRef.current) {
        finalize(nextDone, nextCorrect, nextHard, nextAgain);
      }
    },
    [deck, user, queue, correctCount, hardCount, againCount, done, finalize],
  );

  // Pula o card do topo sem registrar resposta nem alterar o SRS.
  const skip = useCallback(() => {
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0 || endAfterCurrentRef.current) {
      finalize(done, correctCount, hardCount, againCount);
    }
  }, [queue, done, correctCount, hardCount, againCount, finalize]);

  const reset = useCallback(() => {
    setPhase('idle');
    setQueue([]);
    setTotal(0);
    setDone(0);
    setCorrectCount(0);
    setHardCount(0);
    setAgainCount(0);
    setElapsedSeconds(0);
    endAfterCurrentRef.current = false;
  }, []);

  const currentCard = phase === 'studying' ? (queue[0] ?? null) : null;

  return {
    phase,
    currentCard,
    done,
    total,
    correctCount,
    hardCount,
    againCount,
    /** Tempo final da sessão (só preenchido depois de terminar). */
    elapsedSeconds,
    /** Lê o tempo corrente sem re-renderizar — para o relógio da tela. */
    getElapsed: timer.getElapsed,
    start,
    grade,
    skip,
    requestFinish,
    reset,
  };
}
