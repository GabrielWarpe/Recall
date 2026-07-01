import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireNotification } from './notifications';

const STORAGE_KEY = 'recall_unlocked_achievements';

export interface AchievementStats {
  totalCards: number;
  totalSessions: number;
  currentStreak: number;
  deckCount: number;
  lastAccuracy: number; // 0–100, da sessão recém-concluída
}

export interface Achievement {
  id: string;
  title: string;
  body: string;
  earned: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_deck',
    title: '🎉 Primeiro deck!',
    body: 'Você criou seu primeiro deck de flashcards.',
    earned: s => s.deckCount >= 1,
  },
  {
    id: 'first_session',
    title: '📚 Primeira sessão!',
    body: 'Você concluiu sua primeira sessão de estudo.',
    earned: s => s.totalSessions >= 1,
  },
  {
    id: 'cards_50',
    title: '🌟 50 cards estudados!',
    body: 'Você já revisou 50 cards. Bom ritmo!',
    earned: s => s.totalCards >= 50,
  },
  {
    id: 'cards_200',
    title: '🚀 200 cards estudados!',
    body: '200 cards revisados. Imparável!',
    earned: s => s.totalCards >= 200,
  },
  {
    id: 'streak_3',
    title: '🔥 3 dias seguidos!',
    body: 'Sequência de 3 dias. Continue!',
    earned: s => s.currentStreak >= 3,
  },
  {
    id: 'streak_7',
    title: '🔥 Uma semana inteira!',
    body: '7 dias de ofensiva consecutiva.',
    earned: s => s.currentStreak >= 7,
  },
  {
    id: 'streak_30',
    title: '🏆 30 dias!',
    body: 'Um mês inteiro estudando. Lendário!',
    earned: s => s.currentStreak >= 30,
  },
  {
    id: 'perfect_session',
    title: '🎯 Sessão perfeita!',
    body: '100% de acerto numa sessão. Mandou bem!',
    earned: s => s.lastAccuracy >= 100,
  },
];

export async function getUnlocked(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

/**
 * Verifica as conquistas com base nas estatísticas atuais. Para cada conquista
 * recém-desbloqueada, dispara uma notificação (se `notify`) e persiste o estado.
 * Retorna os ids recém-desbloqueados.
 */
export async function checkAchievements(
  stats: AchievementStats,
  notify: boolean,
): Promise<string[]> {
  const unlocked = new Set(await getUnlocked());
  const newly: Achievement[] = [];

  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.earned(stats)) {
      unlocked.add(a.id);
      newly.push(a);
    }
  }

  if (newly.length > 0) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
    if (notify) {
      for (const a of newly) {
        await fireNotification(a.title, a.body);
      }
    }
  }
  return newly.map(a => a.id);
}
