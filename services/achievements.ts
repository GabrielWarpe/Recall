import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireNotification } from './notifications';
import { LEVEL_TIERS, type LevelTier } from '@/utils/xp';

const STORAGE_KEY = 'recall_unlocked_achievements';

export interface AchievementStats {
  totalCards: number;
  totalSessions: number;
  currentStreak: number;
  deckCount: number;
  lastAccuracy: number; // 0–100, da sessão recém-concluída
  level: number; // nível atual (derivado do XP/cards)
}

export interface Achievement {
  id: string;
  title: string;
  body: string;
  earned: (s: AchievementStats) => boolean;
}

/** Conquista de patente derivada de um tier — mantém nome/emoji em sincronia
 * com o card de Nível, então "virar Estudante" na tela é a mesma coisa aqui. */
function tierAchievement(t: LevelTier): Achievement {
  return {
    id: `tier_${t.name.toLowerCase()}`,
    title: `${t.emoji} ${t.name}`,
    body: `Você alcançou a patente ${t.name} (Nível ${t.minLevel}).`,
    earned: s => s.level >= t.minLevel,
  };
}

const tier = (name: string): Achievement =>
  tierAchievement(LEVEL_TIERS.find(t => t.name === name)!);

// Ordenadas como uma jornada: dos primeiros passos às conquistas de prestígio.
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
  tier('Aprendiz'),
  {
    id: 'streak_3',
    title: '🔥 3 dias seguidos!',
    body: 'Sequência de 3 dias. Continue!',
    earned: s => s.currentStreak >= 3,
  },
  {
    id: 'decks_5',
    title: '🗂️ Colecionador',
    body: 'Você criou 5 decks diferentes.',
    earned: s => s.deckCount >= 5,
  },
  {
    id: 'cards_200',
    title: '🚀 200 cards estudados!',
    body: '200 cards revisados. Imparável!',
    earned: s => s.totalCards >= 200,
  },
  tier('Dedicado'),
  {
    id: 'streak_7',
    title: '🔥 Uma semana inteira!',
    body: '7 dias de ofensiva consecutiva.',
    earned: s => s.currentStreak >= 7,
  },
  {
    id: 'perfect_session',
    title: '🎯 Sessão perfeita!',
    body: '100% de acerto numa sessão. Mandou bem!',
    earned: s => s.lastAccuracy >= 100,
  },
  {
    id: 'sessions_50',
    title: '📅 50 sessões',
    body: 'Você concluiu 50 sessões de estudo. Consistência!',
    earned: s => s.totalSessions >= 50,
  },
  {
    id: 'cards_500',
    title: '⚡ 500 cards estudados!',
    body: 'Meio milhar de cards revisados. Que ritmo!',
    earned: s => s.totalCards >= 500,
  },
  tier('Estudante'),
  {
    id: 'streak_14',
    title: '🔥 Duas semanas!',
    body: '14 dias seguidos de estudo. Virou hábito.',
    earned: s => s.currentStreak >= 14,
  },
  {
    id: 'cards_1000',
    title: '🧠 1000 cards estudados!',
    body: 'Mil cards revisados. Memória de aço!',
    earned: s => s.totalCards >= 1000,
  },
  tier('Erudito'),
  {
    id: 'streak_30',
    title: '🏆 30 dias!',
    body: 'Um mês inteiro estudando. Lendário!',
    earned: s => s.currentStreak >= 30,
  },
  tier('Mestre'),
  {
    id: 'streak_100',
    title: '💎 100 dias!',
    body: 'Cem dias de ofensiva. Você é imbatível.',
    earned: s => s.currentStreak >= 100,
  },
  tier('Lenda'),
];

export async function getUnlocked(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

/**
 * Verifica as conquistas com base nas estatísticas atuais. Para cada conquista
 * recém-desbloqueada, dispara uma notificação e persiste o estado.
 * Retorna os ids recém-desbloqueados.
 */
export async function checkAchievements(
  stats: AchievementStats,
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
    for (const a of newly) {
      await fireNotification(a.title, a.body);
    }
  }
  return newly.map(a => a.id);
}
