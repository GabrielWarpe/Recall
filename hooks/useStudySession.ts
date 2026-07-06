import { useState, useCallback, useRef } from 'react';
import type { Flashcard, Deck, Grade, StudyPhase } from '@/types';
import { reviewCard } from '@/services/ai';
import { db } from '@/services/database';
import {
  fireStreakNotification,
  syncReminders,
} from '@/services/notifications';
import { checkAchievements } from '@/services/achievements';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

/**
 * Sessão de estudo com fila. Cada card é concluído uma única vez (ao receber
 * Difícil/Bom/Fácil). "De novo" reenfileira o card ao fim da sessão, então ele
 * reaparece — como nos passos de aprendizagem do Anki. As contagens satisfazem
 * sempre: done = correctCount + hardCount (cada conclusão é uma coisa ou outra);
 * againCount conta as repetições e não entra em `done`.
 */
export function useStudySession(deck: Deck | null) {
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

  const start = useCallback(
    (studyCards: Flashcard[]) => {
      const ordered = settings.shuffle
        ? [...studyCards].sort(() => Math.random() - 0.5)
        : [...studyCards];
      setQueue(ordered);
      setTotal(ordered.length);
      setDone(0);
      setCorrectCount(0);
      setHardCount(0);
      setAgainCount(0);
      setPhase('studying');
      startTimeRef.current = Date.now();
    },
    [settings.shuffle],
  );

  // Encerra a sessão gravando o registro (só se algum card foi concluído).
  const finalize = useCallback(
    (reviewed: number, correct: number, hard: number) => {
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

          const sessions = await db.sessions.getRecent(user.id, 365);
          const playlists = await db.playlists.getAll(user.id);
          await checkAchievements({
            totalCards: sessions.reduce((sum, s) => sum + s.total, 0),
            totalSessions: sessions.length,
            currentStreak: after?.current_streak ?? 0,
            deckCount: playlists.length,
            lastAccuracy: Math.round((correct / reviewed) * 100),
          });

          // Reagenda os lembretes com as contagens pós-sessão: cards recém
          // revisados deixam de estar "devidos" nos próximos dias.
          await syncReminders({
            studyReminder: settings.studyReminder,
            reminderTime: settings.reminderTime,
            streakAlert: settings.streakAlert,
            userId: user.id,
            newPerSession: settings.newPerSession,
          });
        })();
      }
      setPhase('finished');
    },
    [
      deck,
      user,
      refreshProfile,
      settings.streakAlert,
      settings.studyReminder,
      settings.reminderTime,
      settings.newPerSession,
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

      if (nextQueue.length === 0) {
        finalize(nextDone, nextCorrect, nextHard);
      }
    },
    [deck, user, queue, correctCount, hardCount, againCount, done, finalize],
  );

  // Pula o card do topo sem registrar resposta nem alterar o SRS.
  const skip = useCallback(() => {
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) finalize(done, correctCount, hardCount);
  }, [queue, done, correctCount, hardCount, finalize]);

  const reset = useCallback(() => {
    setPhase('idle');
    setQueue([]);
    setTotal(0);
    setDone(0);
    setCorrectCount(0);
    setHardCount(0);
    setAgainCount(0);
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
    start,
    grade,
    skip,
    reset,
  };
}
