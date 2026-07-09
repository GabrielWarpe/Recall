import { format } from 'date-fns';
import { fireNotification } from './notifications';
import { db } from './database';
import { LEVEL_TIERS, type LevelTier, levelFromXp } from '@/utils/xp';
import type { TierIconName } from '@/components/icons/tiers/paths';
import type { Deck, StudySession } from '@/types';

/**
 * Sistema de conquistas (200 no total). As estatísticas são derivadas do que
 * já existe no banco (sessões + decks) — nada novo é persistido além dos ids
 * desbloqueados em `user_achievements`.
 */

// ── Estatísticas usadas pelos critérios ──────────────────────────────────────

export interface AchievementStats {
  // Totais de estudo
  totalCards: number;
  totalSessions: number;
  totalStudySeconds: number;
  distinctStudyDays: number;
  /** Quantos dias da semana diferentes (0-6) já tiveram estudo. */
  distinctWeekdaysStudied: number;
  /** Quantos meses de calendário distintos ("2026-07") tiveram estudo. */
  distinctMonthsStudied: number;
  maxCardsInDay: number;
  /** Maior total de cards revisados acumulado num mesmo deck. */
  maxCardsSameDeck: number;
  perfectSessions: number;
  highAccuracySessions: number;
  /** Sessões iniciadas às 22h ou depois. */
  lateNightSessions: number;
  /** Sessões iniciadas antes das 7h. */
  earlyBirdSessions: number;
  saturdaySessions: number;
  sundaySessions: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  // Criação/coleção
  deckCount: number;
  totalCardsCreated: number;
  /** Cards com alternativas de quiz autoradas (2+). */
  quizCardsCreated: number;
  cardsWithImages: number;
  decksWithCover: number;
  distinctTags: number;
  masteredCards: number;
  biggestDeckSize: number;
  decksWith10PlusCards: number;
  maxTagsOnDeck: number;
  /** Maior nº de cards com imagem num mesmo deck. */
  maxImageCardsSameDeck: number;
  /** Existe deck com 10+ cards onde TODOS têm quiz? */
  hasFullQuizDeck: boolean;
  /** 5+ decks e todos já estudados alguma vez. */
  allDecksStudied: boolean;
  // Última sessão (a que acabou de terminar)
  lastAccuracy: number;
  lastSessionCards: number;
  lastSessionSeconds: number;
  lastSessionAgain: number;
  lastSessionHour: number;
  /** 0 = domingo … 6 = sábado. */
  lastSessionWeekday: number;
  lastSessionDayOfMonth: number;
  /** 1-12. */
  lastSessionMonth: number;
  sessionsSameDay: number;
  decksStudiedSameDay: number;
  /** Estudou antes das 8h E a partir das 20h no mesmo dia. */
  morningAndNightSameDay: boolean;
  /** Dias desde a sessão anterior (0 quando é a primeira). */
  daysSincePreviousSession: number;
  lastTwoPerfect: boolean;
  lastThreePerfect: boolean;
  /** Sessão perfeita logo após uma sessão com menos de 50% de acerto. */
  comebackPerfect: boolean;
}

/** Sessão "perfeita": 5+ cards concluídos sem nenhum "De novo". */
function isPerfect(s: StudySession): boolean {
  return s.correct + s.hard >= 5 && s.again === 0;
}

function accuracyOf(s: StudySession): number {
  const passed = s.correct + s.hard;
  const graded = passed + s.again;
  return graded > 0 ? Math.round((passed / graded) * 100) : 0;
}

/**
 * Deriva todas as estatísticas a partir das sessões (mais recentes primeiro,
 * a primeira sendo a recém-concluída) e dos decks completos.
 */
export function buildAchievementStats(input: {
  sessions: StudySession[];
  decks: Deck[];
  currentStreak: number;
  longestStreak: number;
}): AchievementStats {
  const { sessions, decks, currentStreak, longestStreak } = input;
  const last = sessions[0];
  const lastDate = last ? new Date(last.date) : new Date();
  const dayKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');
  const lastDayKey = last ? dayKey(last.date) : '';

  // Agregados por dia / deck / calendário.
  const cardsByDay = new Map<string, number>();
  const cardsByDeck = new Map<string, number>();
  const weekdays = new Set<number>();
  const months = new Set<string>();
  let totalCards = 0;
  let totalStudySeconds = 0;
  let perfectSessions = 0;
  let highAccuracySessions = 0;
  let lateNightSessions = 0;
  let earlyBirdSessions = 0;
  let saturdaySessions = 0;
  let sundaySessions = 0;
  let sessionsSameDay = 0;
  const decksSameDay = new Set<string>();
  let minHourSameDay = 24;
  let maxHourSameDay = -1;

  for (const s of sessions) {
    const d = new Date(s.date);
    const key = dayKey(s.date);
    totalCards += s.total;
    totalStudySeconds += s.durationSeconds;
    cardsByDay.set(key, (cardsByDay.get(key) ?? 0) + s.total);
    if (s.deckId) {
      cardsByDeck.set(s.deckId, (cardsByDeck.get(s.deckId) ?? 0) + s.total);
    }
    weekdays.add(d.getDay());
    months.add(format(d, 'yyyy-MM'));
    if (isPerfect(s)) perfectSessions += 1;
    if (s.correct + s.hard + s.again >= 5 && accuracyOf(s) >= 80) {
      highAccuracySessions += 1;
    }
    const hour = d.getHours();
    if (hour >= 22) lateNightSessions += 1;
    if (hour < 7) earlyBirdSessions += 1;
    if (d.getDay() === 6) saturdaySessions += 1;
    if (d.getDay() === 0) sundaySessions += 1;
    if (key === lastDayKey) {
      sessionsSameDay += 1;
      if (s.deckId) decksSameDay.add(s.deckId);
      minHourSameDay = Math.min(minHourSameDay, hour);
      maxHourSameDay = Math.max(maxHourSameDay, hour);
    }
  }

  // Coleção.
  const allCards = decks.flatMap(d => d.cards);
  const quizCardsCreated = allCards.filter(
    c => (c.quizOptions?.length ?? 0) >= 2,
  ).length;

  const prev = sessions[1];
  const daysSincePreviousSession = prev
    ? Math.max(
        0,
        Math.floor(
          (lastDate.getTime() - new Date(prev.date).getTime()) / 86_400_000,
        ),
      )
    : 0;

  const lastPerfect = last != null && isPerfect(last);

  return {
    totalCards,
    totalSessions: sessions.length,
    totalStudySeconds,
    distinctStudyDays: cardsByDay.size,
    distinctWeekdaysStudied: weekdays.size,
    distinctMonthsStudied: months.size,
    maxCardsInDay: Math.max(0, ...cardsByDay.values()),
    maxCardsSameDeck: Math.max(0, ...cardsByDeck.values()),
    perfectSessions,
    highAccuracySessions,
    lateNightSessions,
    earlyBirdSessions,
    saturdaySessions,
    sundaySessions,
    level: levelFromXp(totalCards).level,
    currentStreak,
    longestStreak,
    deckCount: decks.length,
    totalCardsCreated: allCards.length,
    quizCardsCreated,
    cardsWithImages: allCards.filter(c => c.images.length > 0).length,
    decksWithCover: decks.filter(d => d.coverUrl != null).length,
    distinctTags: new Set(decks.flatMap(d => d.tags)).size,
    masteredCards: allCards.filter(c => c.mastered).length,
    biggestDeckSize: Math.max(0, ...decks.map(d => d.cards.length)),
    decksWith10PlusCards: decks.filter(d => d.cards.length >= 10).length,
    maxTagsOnDeck: Math.max(0, ...decks.map(d => d.tags.length)),
    maxImageCardsSameDeck: Math.max(
      0,
      ...decks.map(d => d.cards.filter(c => c.images.length > 0).length),
    ),
    hasFullQuizDeck: decks.some(
      d =>
        d.cards.length >= 10 &&
        d.cards.every(c => (c.quizOptions?.length ?? 0) >= 2),
    ),
    allDecksStudied:
      decks.length >= 5 && decks.every(d => d.lastStudied != null),
    lastAccuracy: last ? accuracyOf(last) : 0,
    lastSessionCards: last ? last.correct + last.hard : 0,
    lastSessionSeconds: last?.durationSeconds ?? 0,
    lastSessionAgain: last?.again ?? 0,
    lastSessionHour: lastDate.getHours(),
    lastSessionWeekday: lastDate.getDay(),
    lastSessionDayOfMonth: lastDate.getDate(),
    lastSessionMonth: lastDate.getMonth() + 1,
    sessionsSameDay,
    decksStudiedSameDay: decksSameDay.size,
    morningAndNightSameDay: minHourSameDay < 8 && maxHourSameDay >= 20,
    daysSincePreviousSession,
    lastTwoPerfect:
      lastPerfect && sessions[1] != null && isPerfect(sessions[1]),
    lastThreePerfect:
      lastPerfect &&
      sessions[1] != null &&
      isPerfect(sessions[1]) &&
      sessions[2] != null &&
      isPerfect(sessions[2]),
    comebackPerfect:
      lastPerfect && prev != null && accuracyOf(prev) < 50,
  };
}

// ── Definição das conquistas ─────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  body: string;
  earned: (s: AchievementStats) => boolean;
  /**
   * Só as conquistas de PATENTE têm ícone. As demais continuam trazendo o
   * emoji no início do `title` — a galeria decide o que renderizar.
   */
  icon?: TierIconName;
}

/** Conquista de patente derivada de um tier — mantém nome/emoji em sincronia
 * com o card de Nível, então "virar Estudante" na tela é a mesma coisa aqui. */
function tierAchievement(t: LevelTier): Achievement {
  return {
    // Id derivado do NOME: não mudar nomes de patente sem migrar desbloqueios.
    id: `tier_${t.name.toLowerCase()}`,
    title: t.name,
    body: `Você alcançou a patente ${t.name} (Nível ${t.minLevel}).`,
    earned: s => s.level >= t.minLevel,
    icon: t.icon,
  };
}

const tier = (name: string): Achievement =>
  tierAchievement(LEVEL_TIERS.find(t => t.name === name)!);

const one = (
  id: string,
  title: string,
  body: string,
  earned: (s: AchievementStats) => boolean,
): Achievement => ({ id, title, body, earned });

/** Escada de conquistas por limiar crescente de uma mesma estatística. */
function ladder(
  prefix: string,
  pick: (s: AchievementStats) => number,
  steps: ReadonlyArray<readonly [number, string, string]>,
): Achievement[] {
  return steps.map(([n, title, body]) => ({
    id: `${prefix}_${n}`,
    title,
    body,
    earned: (s: AchievementStats) => pick(s) >= n,
  }));
}

const h = (hours: number) => hours * 3600;

export const ACHIEVEMENTS: Achievement[] = [
  // ── As 20 originais (ids intocados: desbloqueios existentes permanecem) ──
  one('first_deck', '🎉 Primeiro deck!', 'Você criou seu primeiro deck de flashcards.', s => s.deckCount >= 1),
  one('first_session', '📚 Primeira sessão!', 'Você concluiu sua primeira sessão de estudo.', s => s.totalSessions >= 1),
  one('cards_50', '🌟 50 cards estudados!', 'Você já revisou 50 cards. Bom ritmo!', s => s.totalCards >= 50),
  tier('Aprendiz'),
  one('streak_3', '🔥 3 dias seguidos!', 'Sequência de 3 dias. Continue!', s => s.currentStreak >= 3),
  one('decks_5', '🗂️ Colecionador', 'Você criou 5 decks diferentes.', s => s.deckCount >= 5),
  one('cards_200', '🚀 200 cards estudados!', '200 cards revisados. Imparável!', s => s.totalCards >= 200),
  tier('Dedicado'),
  one('streak_7', '🔥 Uma semana inteira!', '7 dias de ofensiva consecutiva.', s => s.currentStreak >= 7),
  one('perfect_session', '🎯 Sessão perfeita!', '100% de acerto numa sessão. Mandou bem!', s => s.lastAccuracy >= 100),
  one('sessions_50', '📅 50 sessões', 'Você concluiu 50 sessões de estudo. Consistência!', s => s.totalSessions >= 50),
  one('cards_500', '⚡ 500 cards estudados!', 'Meio milhar de cards revisados. Que ritmo!', s => s.totalCards >= 500),
  tier('Estudante'),
  one('streak_14', '🔥 Duas semanas!', '14 dias seguidos de estudo. Virou hábito.', s => s.currentStreak >= 14),
  one('cards_1000', '🧠 1000 cards estudados!', 'Mil cards revisados. Memória de aço!', s => s.totalCards >= 1000),
  tier('Erudito'),
  one('streak_30', '🏆 30 dias!', 'Um mês inteiro estudando. Lendário!', s => s.currentStreak >= 30),
  tier('Mestre'),
  one('streak_100', '💎 100 dias!', 'Cem dias de ofensiva. Você é imbatível.', s => s.currentStreak >= 100),
  tier('Lenda'),

  // ── Revisões acumuladas (13) ──
  ...ladder('cards', s => s.totalCards, [
    [100, '💯 Cem por cento card', 'Sua primeira centena de revisões.'],
    [300, '🎳 Strike triplo', '300 cards revisados.'],
    [750, '🏗️ Alicerce pronto', '750 revisões: a base está firme.'],
    [1500, '🌊 Segunda onda', '1.500 cards revisados.'],
    [2500, '🏔️ Meio caminho da montanha', '2.500 revisões e subindo.'],
    [3500, '🚂 Locomotiva', '3.500 cards e nada te para.'],
    [5000, '🌋 Cinco mil!', 'Uma erupção de conhecimento.'],
    [7500, '🛰️ Em órbita', '7.500 revisões — visão de cima.'],
    [10000, '🌌 Dez mil horas? Dez mil cards!', 'O clube dos 10.000.'],
    [15000, '🏛️ Patrimônio mental', '15.000 revisões arquivadas.'],
    [25000, '🐋 Baleia azul', '25.000 cards. Gigante dos mares do saber.'],
    [50000, '☄️ Meio caminho do absurdo', '50.000 revisões. Sério?'],
    [100000, '🪐 Fora de escala', '100.000 cards revisados. Uau.'],
  ]),

  // ── Sessões concluídas (11) ──
  ...ladder('sessions', s => s.totalSessions, [
    [5, '🖐️ Toca aqui', '5 sessões concluídas.'],
    [10, '🎬 Década de sessões', '10 sessões no currículo.'],
    [25, '🥈 Prata da casa', '25 sessões concluídas.'],
    [75, '🎻 Ensaiado', '75 sessões — já é rotina de orquestra.'],
    [100, '💿 Disco de platina', '100 sessões de estudo.'],
    [150, '🧗 Escalada constante', '150 sessões concluídas.'],
    [250, '🏟️ Casa cheia', '250 sessões de estudo.'],
    [365, '🗓️ Uma por dia (quase)', '365 sessões — um ano inteiro delas.'],
    [500, '🎖️ Meio milhar', '500 sessões concluídas.'],
    [1000, '🏰 Fortaleza', '1.000 sessões. Inabalável.'],
    [2000, '🌠 Além do horizonte', '2.000 sessões de estudo.'],
  ]),

  // ── Sequência atual (11) ──
  ...ladder('streak', s => s.currentStreak, [
    [2, '🐣 Dois dias, dois pés', 'A sequência nasceu: 2 dias.'],
    [5, '✋ Cinco na mão', '5 dias seguidos.'],
    [10, '🔟 Nota dez', '10 dias de ofensiva.'],
    [21, '🧲 Hábito imantado', '21 dias — dizem que é o que cria um hábito.'],
    [45, '🌓 Meio caminho dos 90', '45 dias consecutivos.'],
    [50, '🪙 Cinquentinha de ouro', '50 dias seguidos.'],
    [60, '📆 Bimestre perfeito', '60 dias de sequência.'],
    [75, '💪 Hard 75', '75 dias sem falhar.'],
    [150, '🌗 Meio ano à vista', '150 dias consecutivos.'],
    [200, '🛡️ Muralha', '200 dias de ofensiva.'],
    [365, '🌍 Volta completa', 'Um ano inteiro, dia após dia.'],
  ]),

  // ── Níveis (10) ──
  ...ladder('level', s => s.level, [
    [3, '🥉 Bronze curioso', 'Nível 3 alcançado.'],
    [5, '🎈 Alto de cinco', 'Nível 5 alcançado.'],
    [8, '🎱 Bola oito', 'Nível 8 alcançado.'],
    [12, '🕛 Dúzia completa', 'Nível 12 alcançado.'],
    [18, '🔞 Maior de idade', 'Nível 18 alcançado.'],
    [25, '🎂 Bodas de prata', 'Nível 25 alcançado.'],
    [30, '💫 Trintou', 'Nível 30 alcançado.'],
    [40, '🏹 Quarentena do bem', 'Nível 40 alcançado.'],
    [50, '👐 Cinquenta tons de sabedoria', 'Nível 50 alcançado.'],
    [60, '🧙 Fora da curva', 'Nível 60 alcançado.'],
  ]),

  // ── Decks criados (8) ──
  ...ladder('decks', s => s.deckCount, [
    [2, '👯 Em dobro', 'Dois decks criados.'],
    [3, '🎪 Trio de pistas', 'Três decks para revezar.'],
    [7, '🌈 Um por dia da semana', '7 decks criados.'],
    [10, '📦 Décima caixa', '10 decks organizados.'],
    [15, '🗄️ Arquivista', '15 decks criados.'],
    [20, '🏬 Prateleira cheia', '20 decks no acervo.'],
    [30, '🏛️ Ala inteira', '30 decks criados.'],
    [50, '🌆 Biblioteca municipal', '50 decks. Uma cidade de conhecimento.'],
  ]),

  // ── Cards criados (8) ──
  ...ladder('created', s => s.totalCardsCreated, [
    [10, '✍️ Primeiras linhas', '10 cards criados.'],
    [50, '📝 Caderno cheio', '50 cards criados.'],
    [100, '🖨️ Prensa de Gutenberg', '100 cards impressos na memória.'],
    [250, '📖 Capítulo próprio', '250 cards de autoria sua.'],
    [500, '📕 Livro inteiro', '500 cards criados.'],
    [1000, '📚 Obra completa', '1.000 cards criados.'],
    [2500, '🏭 Fábrica de cards', '2.500 cards criados.'],
    [5000, '🌟 Editora independente', '5.000 cards criados.'],
  ]),

  // ── Perguntas de quiz criadas (6) ──
  ...ladder('quizmaker', s => s.quizCardsCreated, [
    [1, '❓ Primeira pegadinha', 'Seu primeiro card com alternativas de quiz.'],
    [10, '🎤 Apresentador', '10 perguntas de quiz criadas.'],
    [25, '🎰 Show do milhão', '25 perguntas com alternativas.'],
    [50, '🧩 Enigmista', '50 perguntas de quiz criadas.'],
    [100, '🎭 Mestre de cerimônias', '100 perguntas de quiz.'],
    [250, '🏆 Roteirista de game show', '250 perguntas criadas.'],
  ]),

  // ── Cards com imagem (4) ──
  ...ladder('imgcards', s => s.cardsWithImages, [
    [1, '🖼️ Vale mais que mil palavras', 'Primeiro card com imagem.'],
    [10, '📷 Fotógrafo do saber', '10 cards ilustrados.'],
    [50, '🎨 Galeria aberta', '50 cards com imagem.'],
    [100, '🏞️ Museu particular', '100 cards ilustrados.'],
  ]),

  // ── Decks com capa (3) ──
  ...ladder('covers', s => s.decksWithCover, [
    [1, '📔 Não julgue pela capa', 'Primeiro deck com foto de capa.'],
    [5, '🎞️ Vitrine caprichada', '5 decks com capa.'],
    [10, '🖼️ Estante instagramável', '10 decks com capa.'],
  ]),

  // ── Tags (5) ──
  ...ladder('tags', s => s.distinctTags, [
    [1, '🏷️ Etiquetado', 'Primeira tag em uso.'],
    [3, '🧵 Linha do assunto', '3 tags diferentes.'],
    [5, '🗃️ Taxonomista', '5 tags organizando tudo.'],
    [10, '🕸️ Teia de temas', '10 tags diferentes.'],
    [15, '🌐 Enciclopedista', '15 tags em uso.'],
  ]),

  // ── Cards dominados (9) ──
  ...ladder('mastered', s => s.masteredCards, [
    [1, '🌟 Primeiro na ponta da língua', 'Seu primeiro card dominado.'],
    [10, '🎓 Dez de dez', '10 cards dominados.'],
    [25, '🥋 Faixa amarela', '25 cards dominados.'],
    [50, '🥋 Faixa roxa', '50 cards dominados.'],
    [100, '🥋 Faixa preta', '100 cards dominados.'],
    [250, '🏅 Coleção de medalhas', '250 cards dominados.'],
    [500, '👑 Meio reino conquistado', '500 cards dominados.'],
    [1000, '🐉 Domador de dragões', '1.000 cards dominados.'],
    [2000, '🌋 Nada te esquece', '2.000 cards dominados.'],
  ]),

  // ── Tempo total de estudo (8) ──
  ...ladder('time', s => s.totalStudySeconds, [
    [h(0.5), '⏱️ Meia hora no relógio', '30 minutos de estudo acumulados.'],
    [h(1), '🕐 Primeira hora', '1 hora estudando no total.'],
    [h(3), '🎥 Um filme inteiro', '3 horas de estudo acumuladas.'],
    [h(5), '🕔 Cinco estrelas... digo, horas', '5 horas de estudo.'],
    [h(10), '⛽ Tanque cheio', '10 horas acumuladas.'],
    [h(24), '🌗 Um dia da sua vida', '24 horas de estudo no total.'],
    [h(50), '🚀 Cinquenta horas de voo', '50 horas acumuladas.'],
    [h(100), '🧳 Centenário de bordo', '100 horas de estudo. Épico.'],
  ]),

  // ── Dias distintos com estudo (7) ──
  ...ladder('days', s => s.distinctStudyDays, [
    [10, '🌤️ Dez amanheceres', 'Estudou em 10 dias diferentes.'],
    [25, '🗓️ Um mês de presenças', '25 dias com estudo.'],
    [50, '🌦️ Cinquenta manhãs', '50 dias diferentes estudando.'],
    [100, '📅 Centenário de presença', '100 dias com estudo.'],
    [200, '🍂 Duzentas folhas viradas', '200 dias diferentes.'],
    [300, '🎆 Quase um ano de dias', '300 dias com estudo.'],
    [500, '🏔️ Quinhentos picos', '500 dias diferentes estudando.'],
  ]),

  // ── Sessões perfeitas acumuladas (5) ──
  ...ladder('perfects', s => s.perfectSessions, [
    [3, '🎯 Três na mosca', '3 sessões perfeitas.'],
    [5, '🖐️ Mão calibrada', '5 sessões perfeitas.'],
    [10, '🏹 Olho de águia', '10 sessões perfeitas.'],
    [25, '🎼 Afinado', '25 sessões perfeitas.'],
    [50, '💎 Lapidado', '50 sessões perfeitas.'],
  ]),

  // ── Sessões com 80%+ (4) ──
  ...ladder('sharp', s => s.highAccuracySessions, [
    [10, '📈 Consistência afiada', '10 sessões com 80%+ de acerto.'],
    [25, '🔪 Fio de navalha', '25 sessões com 80%+.'],
    [50, '⚔️ Lâmina mestra', '50 sessões com 80%+.'],
    [100, '🗡️ Excalibur', '100 sessões com 80%+.'],
  ]),

  // ── Cards num único dia (5) ──
  ...ladder('dayvolume', s => s.maxCardsInDay, [
    [50, '🌪️ Vendaval', '50 cards num único dia.'],
    [100, '🌊 Tsunami de revisões', '100 cards num só dia.'],
    [150, '🏃 Ultramaratona', '150 cards num dia.'],
    [250, '🚁 Modo turbina', '250 cards num único dia.'],
    [500, '☄️ Dia meteórico', '500 cards em 24 horas.'],
  ]),

  // ── Revisões acumuladas num mesmo deck (5) ──
  ...ladder('loyal', s => s.maxCardsSameDeck, [
    [100, '🪴 Regando a mesma planta', '100 revisões num mesmo deck.'],
    [250, '🌳 Árvore frondosa', '250 revisões no mesmo deck.'],
    [500, '🏡 Quintal conhecido', '500 revisões num único deck.'],
    [1000, '🗻 Monte fiel', '1.000 revisões no mesmo deck.'],
    [2500, '🌲 Sequoia milenar', '2.500 revisões num só deck.'],
  ]),

  // ── Sessões noturnas 22h+ (3) ──
  ...ladder('night', s => s.lateNightSessions, [
    [5, '🌙 Turno da lua', '5 sessões depois das 22h.'],
    [15, '🦉 Sindicato das corujas', '15 sessões noturnas.'],
    [30, '🌌 Guardião da madrugada', '30 sessões depois das 22h.'],
  ]),

  // ── Sessões madrugadoras <7h (3) ──
  ...ladder('dawn', s => s.earlyBirdSessions, [
    [5, '🌅 Clube das 6', '5 sessões antes das 7h.'],
    [15, '🐓 Amigo do galo', '15 sessões madrugadoras.'],
    [30, '☀️ Acorda que o sol te espera', '30 sessões antes das 7h.'],
  ]),

  // ── Horário & calendário (20) ──
  one('owl_deep', '🦇 Modo morcego', 'Estudou entre meia-noite e as 4h.', s => s.lastSessionHour <= 3),
  one('before_coffee', '☕ Antes do café', 'Sessão iniciada antes das 6h.', s => s.lastSessionHour < 6),
  one('lunch_break', '🥪 Intervalo produtivo', 'Estudou na hora do almoço (12h–13h).', s => s.lastSessionHour === 12 || s.lastSessionHour === 13),
  one('midnight_sharp', '🕛 Cinderela às avessas', 'Sessão iniciada à meia-noite em ponto (0h).', s => s.lastSessionHour === 0),
  one('after_work', '🍻 Happy hour do cérebro', 'Estudou às 18h — hora do descanso? Não pra você.', s => s.lastSessionHour === 18),
  one('saturday', '🛋️ Sábado sem preguiça', 'Estudou num sábado.', s => s.lastSessionWeekday === 6),
  one('sunday', '⛪ Domingo dedicado', 'Estudou num domingo.', s => s.lastSessionWeekday === 0),
  one('full_weekend', '🎡 Fim de semana completo', 'Já estudou em sábados E domingos.', s => s.saturdaySessions >= 1 && s.sundaySessions >= 1),
  one('monday', '💼 Segunda sem desculpa', 'Estudou numa segunda-feira.', s => s.lastSessionWeekday === 1),
  one('friday_night', '🪩 Sexta alternativa', 'Estudando na sexta depois das 20h. Respeito.', s => s.lastSessionWeekday === 5 && s.lastSessionHour >= 20),
  one('first_of_month', '📌 Começando o mês certo', 'Estudou no dia 1º do mês.', s => s.lastSessionDayOfMonth === 1),
  one('new_years_eve', '🎇 Réveillon dedicado', 'Estudou num 31 de dezembro.', s => s.lastSessionDayOfMonth === 31 && s.lastSessionMonth === 12),
  one('new_year', '🎊 Resolução cumprida', 'Estudou num 1º de janeiro.', s => s.lastSessionDayOfMonth === 1 && s.lastSessionMonth === 1),
  one('christmas', '🎄 Presente pra você mesmo', 'Estudou no Natal.', s => s.lastSessionDayOfMonth === 25 && s.lastSessionMonth === 12),
  one('christmas_eve', '🎅 Véspera aplicada', 'Estudou num 24 de dezembro.', s => s.lastSessionDayOfMonth === 24 && s.lastSessionMonth === 12),
  one('halloween', '🎃 Truque ou revisão', 'Estudou num 31 de outubro.', s => s.lastSessionDayOfMonth === 31 && s.lastSessionMonth === 10),
  one('valentines', '💘 Amor pelos estudos', 'Estudou no Dia dos Namorados (12/6).', s => s.lastSessionDayOfMonth === 12 && s.lastSessionMonth === 6),
  one('student_day', '🎓 No seu dia', 'Estudou no Dia do Estudante (11/8).', s => s.lastSessionDayOfMonth === 11 && s.lastSessionMonth === 8),
  one('sao_joao', '🔥🌽 Arraiá do saber', 'Estudou num 24 de junho, dia de São João.', s => s.lastSessionDayOfMonth === 24 && s.lastSessionMonth === 6),
  one('april_fools', '🤡 Não é mentira', 'Estudou num 1º de abril. Sério mesmo.', s => s.lastSessionDayOfMonth === 1 && s.lastSessionMonth === 4),

  // ── Intensidade & fôlego (12) ──
  one('big_session_30', '🏋️ Série pesada', '30+ cards concluídos numa única sessão.', s => s.lastSessionCards >= 30),
  one('big_session_50', '🐘 Sessão elefante', '50+ cards numa única sessão.', s => s.lastSessionCards >= 50),
  one('big_session_100', '🦖 Sessão jurássica', '100+ cards numa única sessão!', s => s.lastSessionCards >= 100),
  one('focus_15', '🧘 Quarto de hora zen', 'Sessão de 15+ minutos sem largar.', s => s.lastSessionSeconds >= 900),
  one('focus_30', '🕯️ Meia hora de foco', 'Sessão de 30+ minutos.', s => s.lastSessionSeconds >= 1800),
  one('focus_60', '🧗 Uma hora na parede', 'Sessão de 1 hora ou mais.', s => s.lastSessionSeconds >= 3600),
  one('lightning', '⚡ Relâmpago', '10+ cards em menos de 1 minuto.', s => s.lastSessionCards >= 10 && s.lastSessionSeconds > 0 && s.lastSessionSeconds < 60),
  one('express', '🚄 Trem-bala', '25+ cards em menos de 3 minutos.', s => s.lastSessionCards >= 25 && s.lastSessionSeconds > 0 && s.lastSessionSeconds < 180),
  one('double_shift', '👔 Dobradinha', '2 sessões no mesmo dia.', s => s.sessionsSameDay >= 2),
  one('triple_shift', '🎩 Turno triplo', '3 sessões no mesmo dia.', s => s.sessionsSameDay >= 3),
  one('five_shift', '🐝 Abelha operária', '5 sessões num único dia.', s => s.sessionsSameDay >= 5),
  one('sandwich', '🥯 Sanduíche de estudo', 'Estudou de manhã cedo E à noite no mesmo dia.', s => s.morningAndNightSameDay),

  // ── Superação & constância (10) ──
  one('persistent', '🐢 Devagar e sempre', 'Terminou uma sessão mesmo com 10+ "De novo".', s => s.lastSessionAgain >= 10),
  one('phoenix', '🐦‍🔥 Fênix', 'Voltou a estudar após 7+ dias parado.', s => s.daysSincePreviousSession >= 7),
  one('reborn', '🌱 Renascido', 'Voltou após 30+ dias. O que importa é voltar.', s => s.daysSincePreviousSession >= 30),
  one('rock_solid', '🗿 Rocha', '20+ cards numa sessão sem nenhum "De novo".', s => s.lastSessionCards >= 20 && s.lastSessionAgain === 0),
  one('double_perfect', '✌️ Dupla perfeita', 'Duas sessões perfeitas seguidas.', s => s.lastTwoPerfect),
  one('hat_trick', '🎩⚽ Hat-trick', 'Três sessões perfeitas em sequência.', s => s.lastThreePerfect),
  one('comeback', '🔄 Virada épica', 'Sessão perfeita logo após uma com menos de 50%.', s => s.comebackPerfect),
  one('full_week_coverage', '🧭 Todos os dias da semana', 'Já estudou em cada um dos 7 dias da semana.', s => s.distinctWeekdaysStudied >= 7),
  one('half_year_months', '🌦️ Seis estações', 'Estudou em 6 meses de calendário diferentes.', s => s.distinctMonthsStudied >= 6),
  one('full_year_months', '🪐 Ano completo', 'Estudou em 12 meses de calendário diferentes.', s => s.distinctMonthsStudied >= 12),

  // ── Coleção & criação (10) ──
  one('big_deck_50', '🐳 Deck baleia', 'Um deck com 50+ cards.', s => s.biggestDeckSize >= 50),
  one('big_deck_100', '🏟️ Deck estádio', 'Um deck com 100+ cards.', s => s.biggestDeckSize >= 100),
  one('five_solid_decks', '🧱 Cinco pilares', '5 decks com 10+ cards cada.', s => s.decksWith10PlusCards >= 5),
  one('ten_solid_decks', '🏯 Dez torres', '10 decks com 10+ cards cada.', s => s.decksWith10PlusCards >= 10),
  one('no_deck_behind', '🐑 Nenhum deck para trás', '5+ decks e todos já foram estudados.', s => s.allDecksStudied),
  one('curator', '🎗️ Curador', 'Um deck com 3+ tags.', s => s.maxTagsOnDeck >= 3),
  one('master_curator', '🏵️ Curador-chefe', 'Um deck com 5+ tags.', s => s.maxTagsOnDeck >= 5),
  one('multimedia_deck', '📽️ Deck multimídia', '10+ cards com imagem num mesmo deck.', s => s.maxImageCardsSameDeck >= 10),
  one('quizified_deck', '🎯 Deck 100% quiz', 'Um deck (10+ cards) onde todos têm alternativas.', s => s.hasFullQuizDeck),
  one('deck_tour', '🎠 Giro completo', 'Estudou 3+ decks diferentes no mesmo dia.', s => s.decksStudiedSameDay >= 3),
];

if (__DEV__ && ACHIEVEMENTS.length !== 200) {
  console.warn(`[Recall] ACHIEVEMENTS deveria ter 200 itens, tem ${ACHIEVEMENTS.length}`);
}

// ── Persistência e verificação ───────────────────────────────────────────────

/** Conquistas desbloqueadas do usuário — vivem no banco, por conta. */
export async function getUnlocked(userId: string): Promise<string[]> {
  return db.achievements.getUnlocked(userId);
}

/**
 * Verifica as conquistas com base nas estatísticas atuais. Para cada conquista
 * recém-desbloqueada, dispara uma notificação (limitado a 3 + resumo, para não
 * inundar quem desbloqueia muitas de uma vez) e persiste o estado na conta.
 * Retorna os ids recém-desbloqueados.
 */
export async function checkAchievements(
  userId: string,
  stats: AchievementStats,
): Promise<string[]> {
  const unlocked = new Set(await getUnlocked(userId));
  const newly: Achievement[] = [];

  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.earned(stats)) {
      unlocked.add(a.id);
      newly.push(a);
    }
  }

  if (newly.length > 0) {
    await db.achievements.unlock(userId, newly.map(a => a.id));
    const toNotify = newly.slice(0, 3);
    for (const a of toNotify) {
      await fireNotification(a.title, a.body);
    }
    if (newly.length > toNotify.length) {
      await fireNotification(
        '🏆 Chuva de conquistas!',
        `E mais ${newly.length - toNotify.length} conquistas desbloqueadas. Veja na tela de Conquistas.`,
      );
    }
  }
  return newly.map(a => a.id);
}
