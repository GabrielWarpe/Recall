import { useState, useCallback } from 'react';
import { isSameDay } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { db } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';
import { computeStreak, computeLongestStreak } from '@/utils/streak';

/**
 * Calcula a sequência (streak) e os cards estudados hoje a partir das sessões
 * reais. Recarrega sempre que a tela ganha foco — assim a meta diária e o fogo
 * atualizam ao voltar de uma sessão de estudo.
 */
export function useStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [studiedToday, setStudiedToday] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void (async () => {
        const sessions = await db.sessions.getRecent(user.id, 365);
        const dates = sessions.map(s => s.date);

        setStreak(computeStreak(dates));
        setLongestStreak(computeLongestStreak(dates));

        const today = new Date();
        const todaySessions = sessions.filter(s =>
          isSameDay(new Date(s.date), today),
        );
        setTodayCount(todaySessions.reduce((sum, s) => sum + s.total, 0));
        setStudiedToday(todaySessions.length > 0);
      })();
    }, [user]),
  );

  return { streak, longestStreak, studiedToday, todayCount };
}
