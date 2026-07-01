import { useState, useCallback, useRef } from 'react';
import type { Flashcard, Deck, StudyResult, StudyPhase } from '@/types';
import { reviewCard } from '@/services/ai';
import { db } from '@/services/database';
import { fireStreakNotification } from '@/services/notifications';
import { checkAchievements } from '@/services/achievements';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';

export function useStudySession(deck: Deck | null) {
  const { user, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const [phase, setPhase] = useState<StudyPhase>('idle');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<StudyResult[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const startTimeRef = useRef<number>(0);

  const start = useCallback(
    (studyCards: Flashcard[]) => {
      const ordered = settings.shuffle
        ? [...studyCards].sort(() => Math.random() - 0.5)
        : [...studyCards];
      setCards(ordered);
      setCurrentIndex(0);
      setResults([]);
      setCorrectCount(0);
      setIncorrectCount(0);
      setPhase('studying');
      startTimeRef.current = Date.now();
    },
    [settings.shuffle],
  );

  // Encerra a sessão salvando apenas os cards realmente respondidos
  // (cards pulados não contam para revisados/acertos/erros).
  const finalize = useCallback(
    (finalCorrect: number, finalIncorrect: number) => {
      const answered = finalCorrect + finalIncorrect;
      if (deck && user && answered > 0) {
        const startedAt = new Date(startTimeRef.current).toISOString();
        void (async () => {
          await db.sessions.create({
            user_id: user.id,
            playlist_id: deck.id,
            started_at: startedAt,
            ended_at: new Date().toISOString(),
            cards_reviewed: answered,
            correct_count: finalCorrect,
            hard_count: finalIncorrect,
          });
          await db.decks.touchStudied(deck.id);

          const before = await db.profile.get(user.id);
          const after = await db.profile.updateStreak(user.id);
          await refreshProfile();

          // ── Notificação de sequência (ao estender a ofensiva hoje) ──
          if (
            settings.streakAlert &&
            after &&
            before &&
            after.current_streak > before.current_streak
          ) {
            await fireStreakNotification(after.current_streak);
          }

          // ── Conquistas ──
          const sessions = await db.sessions.getRecent(user.id, 365);
          const playlists = await db.playlists.getAll(user.id);
          await checkAchievements(
            {
              totalCards: sessions.reduce((sum, s) => sum + s.total, 0),
              totalSessions: sessions.length,
              currentStreak: after?.current_streak ?? 0,
              deckCount: playlists.length,
              lastAccuracy: Math.round((finalCorrect / answered) * 100),
            },
            settings.achievements,
          );
        })();
      }
      setPhase('finished');
    },
    [deck, user, refreshProfile, settings.streakAlert, settings.achievements],
  );

  const answer = useCallback(
    async (correct: boolean) => {
      if (!deck || !user) return;

      const idx = currentIndex;
      const card = cards[idx];
      if (!card) return;

      // Persiste a revisão SM-2 do card individual no Supabase.
      const updatedCard = reviewCard(card, correct);
      void db.decks.reviewCard(updatedCard);

      const nextCorrect = correctCount + (correct ? 1 : 0);
      const nextIncorrect = incorrectCount + (correct ? 0 : 1);
      if (correct) setCorrectCount(nextCorrect);
      else setIncorrectCount(nextIncorrect);

      setResults(prev => [...prev, { cardId: card.id, correct }]);

      if (idx + 1 >= cards.length) finalize(nextCorrect, nextIncorrect);
      else setCurrentIndex(i => i + 1);
    },
    [deck, user, currentIndex, cards, correctCount, incorrectCount, finalize],
  );

  // Avança para o próximo card sem registrar resposta nem alterar o SRS.
  const skip = useCallback(() => {
    if (currentIndex + 1 >= cards.length) {
      finalize(correctCount, incorrectCount);
    } else {
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex, cards.length, correctCount, incorrectCount, finalize]);

  const reset = useCallback(() => {
    setPhase('idle');
    setCards([]);
    setCurrentIndex(0);
    setResults([]);
    setCorrectCount(0);
    setIncorrectCount(0);
  }, []);

  const currentCard =
    phase === 'studying' ? (cards[currentIndex] ?? null) : null;

  return {
    phase,
    currentCard,
    currentIndex,
    total: cards.length,
    correctCount,
    incorrectCount,
    start,
    answer,
    skip,
    reset,
  };
}
