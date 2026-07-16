import { format } from 'date-fns';
import { fireNotification } from './notifications';
import { db } from './database';
import { LEVEL_TIERS, type LevelTier, levelFromXp } from '@/utils/xp';
import type { Deck, StudySession, StudyMode } from '@/types';

/**
 * Sistema de conquistas (73 no total, ícone único por conquista — o mapa 1:1
 * vive em `services/achievementIcons.ts`).
 *
 * Duas regras de desenho:
 *  - Toda condição é derivada do HISTÓRICO, nunca só da última sessão. Assim
 *    nenhuma conquista é "perdível" (se você já fez, ela dispara na próxima
 *    verificação), e conquistas novas desbloqueiam retroativamente.
 *  - Nada é persistido além dos ids desbloqueados em `user_achievements`;
 *    ids removidos de versões antigas ficam no banco e são ignorados.
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
  /** Sessões "perfeitas": 5+ cards concluídos sem nenhum "De novo". */
  perfectSessions: number;
  /** Sessões iniciadas às 22h ou depois. */
  lateNightSessions: number;
  /** Sessões iniciadas antes das 7h. */
  earlyBirdSessions: number;
  level: number;
  /** Melhor sequência de dias — a atual ou o recorde, o que for maior. */
  bestStreak: number;
  // Recordes por sessão/dia (histórico inteiro, não só a última)
  maxCardsSameDeck: number;
  maxSessionCards: number;
  maxSessionSeconds: number;
  maxSessionsInDay: number;
  maxDecksInDay: number;
  /** Algum dia teve sessão antes das 8h E a partir das 20h? */
  hasMorningAndNightDay: boolean;
  /** Maior intervalo (dias) entre duas sessões consecutivas. */
  maxGapDays: number;
  /** Alguma sessão com 20+ cards e zero "De novo"? */
  hasRockSolidSession: boolean;
  /** Alguma sessão concluída com 10+ "De novo"? */
  hasGrittySession: boolean;
  /** Três sessões perfeitas consecutivas em algum ponto do histórico? */
  hasThreePerfectRun: boolean;
  /** Sessão perfeita logo após uma com <50% de acerto (5+ avaliados)? */
  hasComeback: boolean;
  // Modos de estudo
  sessionsByMode: Record<StudyMode, number>;
  distinctModes: number;
  // Coleção/criação
  deckCount: number;
  totalCardsCreated: number;
  /** Cards com alternativas de quiz autoradas (2+). */
  quizCardsCreated: number;
  masteredCards: number;
  biggestDeckSize: number;
  decksWith10PlusCards: number;
  /** Maior nº de cards com imagem num mesmo deck. */
  maxImageCardsSameDeck: number;
  /** Existe deck com 10+ cards onde TODOS têm quiz? */
  hasFullQuizDeck: boolean;
  /** 5+ decks e todos já estudados alguma vez. */
  allDecksStudied: boolean;
  // Retenção & leeches (de card_reviews)
  /** Cards que acumularam 4+ "De novo" e hoje estão dominados. */
  leechesTamed: number;
  /** Revisões dos últimos 30 dias: total e quantas não foram "De novo". */
  retention30: { total: number; retained: number };
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
 * Deriva as estatísticas do histórico (sessões mais recentes primeiro) e dos
 * decks completos. `leechesTamed`/`retention30` chegam prontos porque vêm de
 * `card_reviews` (consultas próprias do chamador).
 */
export function buildAchievementStats(input: {
  sessions: StudySession[];
  decks: Deck[];
  currentStreak: number;
  longestStreak: number;
  leechesTamed: number;
  retention30: { total: number; retained: number };
}): AchievementStats {
  const { sessions, decks } = input;
  const dayKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

  const cardsByDeck = new Map<string, number>();
  const sessionsByDay = new Map<string, number>();
  const decksByDay = new Map<string, Set<string>>();
  const hoursByDay = new Map<string, { min: number; max: number }>();
  const weekdays = new Set<number>();
  const months = new Set<string>();
  const sessionsByMode: Record<StudyMode, number> = {
    flash: 0,
    quiz: 0,
    write: 0,
    mixed: 0,
  };
  let totalCards = 0;
  let totalStudySeconds = 0;
  let perfectSessions = 0;
  let lateNightSessions = 0;
  let earlyBirdSessions = 0;
  let maxSessionCards = 0;
  let maxSessionSeconds = 0;
  let hasRockSolidSession = false;
  let hasGrittySession = false;
  let hasThreePerfectRun = false;
  let hasComeback = false;
  let maxGapDays = 0;
  let perfectRun = 0;

  sessions.forEach((s, i) => {
    const d = new Date(s.date);
    const key = dayKey(s.date);
    const done = s.correct + s.hard;
    totalCards += s.total;
    totalStudySeconds += s.durationSeconds;
    cardsByDeck.set(s.deckId, (cardsByDeck.get(s.deckId) ?? 0) + s.total);
    sessionsByDay.set(key, (sessionsByDay.get(key) ?? 0) + 1);
    if (s.deckId) {
      const set = decksByDay.get(key) ?? new Set<string>();
      set.add(s.deckId);
      decksByDay.set(key, set);
    }
    const hour = d.getHours();
    const hb = hoursByDay.get(key) ?? { min: 24, max: -1 };
    hb.min = Math.min(hb.min, hour);
    hb.max = Math.max(hb.max, hour);
    hoursByDay.set(key, hb);
    weekdays.add(d.getDay());
    months.add(format(d, 'yyyy-MM'));
    sessionsByMode[s.mode ?? 'flash'] += 1;
    if (isPerfect(s)) perfectSessions += 1;
    if (hour >= 22) lateNightSessions += 1;
    if (hour < 7) earlyBirdSessions += 1;
    maxSessionCards = Math.max(maxSessionCards, done);
    maxSessionSeconds = Math.max(maxSessionSeconds, s.durationSeconds);
    if (done >= 20 && s.again === 0) hasRockSolidSession = true;
    if (s.again >= 10) hasGrittySession = true;

    // Sequências e viradas: `sessions` vem em ordem decrescente, então o
    // item i+1 é a sessão ANTERIOR no tempo.
    perfectRun = isPerfect(s) ? perfectRun + 1 : 0;
    if (perfectRun >= 3) hasThreePerfectRun = true;
    const prev = sessions[i + 1];
    if (prev) {
      const gap = Math.floor(
        (d.getTime() - new Date(prev.date).getTime()) / 86_400_000,
      );
      maxGapDays = Math.max(maxGapDays, gap);
      if (
        isPerfect(s) &&
        prev.correct + prev.hard + prev.again >= 5 &&
        accuracyOf(prev) < 50
      ) {
        hasComeback = true;
      }
    }
  });

  const allCards = decks.flatMap(d => d.cards);

  return {
    totalCards,
    totalSessions: sessions.length,
    totalStudySeconds,
    distinctStudyDays: sessionsByDay.size,
    distinctWeekdaysStudied: weekdays.size,
    distinctMonthsStudied: months.size,
    perfectSessions,
    lateNightSessions,
    earlyBirdSessions,
    level: levelFromXp(totalCards).level,
    bestStreak: Math.max(input.currentStreak, input.longestStreak),
    maxCardsSameDeck: Math.max(0, ...cardsByDeck.values()),
    maxSessionCards,
    maxSessionSeconds,
    maxSessionsInDay: Math.max(0, ...sessionsByDay.values()),
    maxDecksInDay: Math.max(0, ...[...decksByDay.values()].map(s => s.size)),
    hasMorningAndNightDay: [...hoursByDay.values()].some(
      h => h.min < 8 && h.max >= 20,
    ),
    maxGapDays,
    hasRockSolidSession,
    hasGrittySession,
    hasThreePerfectRun,
    hasComeback,
    sessionsByMode,
    distinctModes: Object.values(sessionsByMode).filter(n => n > 0).length,
    deckCount: decks.length,
    totalCardsCreated: allCards.length,
    quizCardsCreated: allCards.filter(c => (c.quizOptions?.length ?? 0) >= 2)
      .length,
    masteredCards: allCards.filter(c => c.mastered).length,
    biggestDeckSize: Math.max(0, ...decks.map(d => d.cards.length)),
    decksWith10PlusCards: decks.filter(d => d.cards.length >= 10).length,
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
    leechesTamed: input.leechesTamed,
    retention30: input.retention30,
  };
}

// ── Definição das conquistas ─────────────────────────────────────────────────

export interface Achievement {
  id: string;
  title: string;
  body: string;
  earned: (s: AchievementStats) => boolean;
}

/** Conquista de patente derivada de um tier — desbloquear a patente na tela
 * de Nível e ganhar a conquista são o mesmo evento. */
function tierAchievement(t: LevelTier): Achievement {
  return {
    // Id derivado do NOME: não mudar nomes de patente sem migrar desbloqueios.
    id: `tier_${t.name.toLowerCase()}`,
    title: t.name,
    body: `Você alcançou a patente ${t.name} (Nível ${t.minLevel}).`,
    earned: s => s.level >= t.minLevel,
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

/** Escada por limiar crescente de uma mesma estatística. */
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

// O emoji no início do título é usado SÓ pela notificação de desbloqueio;
// a galeria o remove e mostra o emblema (achievementIcons.ts) no lugar.
export const ACHIEVEMENTS: Achievement[] = [
  // ── Patentes (6) — espelham LEVEL_TIERS ──
  tier('Aprendiz'),
  tier('Dedicado'),
  tier('Estudante'),
  tier('Erudito'),
  tier('Mestre'),
  tier('Lenda'),

  // ── Revisões acumuladas (6) ──
  ...ladder('cards', s => s.totalCards, [
    [100, '💯 Primeira centena', '100 cards revisados.'],
    [500, '📚 Estante cheia', '500 revisões acumuladas.'],
    [1000, '🧠 Memória de aço', '1.000 cards revisados.'],
    [2500, '🏔️ Vista do topo', '2.500 revisões e subindo.'],
    [5000, '🌋 Erupção', '5.000 cards revisados.'],
    [10000, '🪐 Fora de órbita', 'O clube dos 10.000.'],
  ]),

  // ── Constância (5) — vale a melhor sequência, atual ou recorde ──
  ...ladder('streak', s => s.bestStreak, [
    [7, '🔥 Uma semana inteira', '7 dias seguidos de estudo.'],
    [21, '🧲 Hábito formado', '21 dias — o hábito virou rotina.'],
    [50, '☀️ Cinquenta sóis', '50 dias consecutivos.'],
    [100, '🛡️ Centurião', '100 dias sem falhar.'],
    [365, '🌍 Volta ao sol', 'Um ano inteiro, dia após dia.'],
  ]),

  // ── Sessões concluídas (5) ──
  ...ladder('sessions', s => s.totalSessions, [
    [10, '🎬 Ritmo criado', '10 sessões concluídas.'],
    [50, '📅 Rotina de verdade', '50 sessões de estudo.'],
    [100, '💿 Disco de platina', '100 sessões concluídas.'],
    [250, '🏟️ Casa cheia', '250 sessões de estudo.'],
    [500, '🏰 Fortaleza', '500 sessões. Inabalável.'],
  ]),

  // ── Maestria (5) ──
  ...ladder('mastered', s => s.masteredCards, [
    [1, '🌟 Na ponta da língua', 'Seu primeiro card dominado.'],
    [10, '🎓 Dez de dez', '10 cards dominados.'],
    [50, '🥋 Faixa preta', '50 cards dominados.'],
    [250, '💎 Tesouro lapidado', '250 cards dominados.'],
    [1000, '🐉 Domador de dragões', '1.000 cards dominados.'],
  ]),

  // ── Tempo de estudo (4) ──
  ...ladder('time', s => s.totalStudySeconds, [
    [h(1), '🕐 Primeira hora', '1 hora de estudo acumulada.'],
    [h(10), '🕙 Dez horas de voo', '10 horas acumuladas.'],
    [h(24), '🌗 Um dia da sua vida', '24 horas de estudo no total.'],
    [h(100), '⏳ Cem horas', '100 horas de estudo. Épico.'],
  ]),

  // ── Presença (3) — dias distintos, consecutivos ou não ──
  ...ladder('days', s => s.distinctStudyDays, [
    [25, '🗓️ Um mês de presenças', 'Estudou em 25 dias diferentes.'],
    [100, '📅 Centenário', '100 dias com estudo.'],
    [300, '🎆 Quase um ano de dias', '300 dias diferentes estudando.'],
  ]),

  // ── Precisão (3) — sessões perfeitas: 5+ cards, zero "De novo" ──
  ...ladder('perfects', s => s.perfectSessions, [
    [5, '🎯 Mão calibrada', '5 sessões perfeitas.'],
    [25, '🎼 Afinado', '25 sessões perfeitas.'],
    [50, '🏆 Lapidado', '50 sessões perfeitas.'],
  ]),

  // ── Criação (3) ──
  ...ladder('created', s => s.totalCardsCreated, [
    [50, '📝 Caderno cheio', '50 cards criados.'],
    [250, '📖 Capítulo próprio', '250 cards de autoria sua.'],
    [1000, '📚 Obra completa', '1.000 cards criados.'],
  ]),

  // ── Dedicação a um deck (2) ──
  ...ladder('loyal', s => s.maxCardsSameDeck, [
    [250, '🪴 Regando a mesma planta', '250 revisões num mesmo deck.'],
    [1000, '🗻 Monte fiel', '1.000 revisões num único deck.'],
  ]),

  // ── Primeiros passos ──
  one('first_deck', '🎉 Primeiro deck', 'Você criou seu primeiro deck de flashcards.', s => s.deckCount >= 1),
  one('first_session', '🪜 Primeiro degrau', 'Você concluiu sua primeira sessão de estudo.', s => s.totalSessions >= 1),
  one('perfect_session', '⭐ Sessão perfeita', '5+ cards numa sessão sem nenhum "De novo".', s => s.perfectSessions >= 1),

  // ── Intensidade & foco ──
  one('big_session_50', '🏋️ Série pesada', '50+ cards concluídos numa única sessão.', s => s.maxSessionCards >= 50),
  one('big_session_100', '🦖 Sessão jurássica', '100+ cards numa única sessão.', s => s.maxSessionCards >= 100),
  one('focus_60', '🧘 Uma hora na cadeira', 'Uma sessão de 60+ minutos.', s => s.maxSessionSeconds >= 3600),
  one('triple_shift', '🎩 Turno triplo', '3 sessões num mesmo dia.', s => s.maxSessionsInDay >= 3),
  one('sandwich', '🥪 Sanduíche de estudo', 'Manhã cedo E noite no mesmo dia.', s => s.hasMorningAndNightDay),
  one('deck_tour', '🎠 Giro completo', '3+ decks estudados no mesmo dia.', s => s.maxDecksInDay >= 3),

  // ── Precisão & superação ──
  one('rock_solid', '🗿 Rocha', '20+ cards numa sessão sem nenhum "De novo".', s => s.hasRockSolidSession),
  one('hat_trick', '⚽ Hat-trick', 'Três sessões perfeitas em sequência.', s => s.hasThreePerfectRun),
  one('comeback', '🔄 Virada épica', 'Sessão perfeita logo após uma com menos de 50%.', s => s.hasComeback),
  one('persistent', '🐢 Devagar e sempre', 'Terminou uma sessão mesmo com 10+ "De novo".', s => s.hasGrittySession),
  one('phoenix', '🐦‍🔥 Fênix', 'Voltou a estudar após 7+ dias parado.', s => s.maxGapDays >= 7),
  one('reborn', '🌱 Renascido', 'Voltou após 30+ dias. O que importa é voltar.', s => s.maxGapDays >= 30),

  // ── Retenção & leeches (card_reviews) ──
  one('leech_tamed', '🐍 Fera domada', 'Dominou um card que acumulou 4+ "De novo".', s => s.leechesTamed >= 1),
  one('leech_tamed_10', '🐲 Domador de feras', '10 cards difíceis domados.', s => s.leechesTamed >= 10),
  one('retention_85', '🐘 Memória de elefante', 'Retenção de 85%+ nos últimos 30 dias (100+ revisões).', s => s.retention30.total >= 100 && s.retention30.retained / s.retention30.total >= 0.85),

  // ── Cobertura de vida ──
  one('full_week_coverage', '🧭 Semana completa', 'Já estudou em cada um dos 7 dias da semana.', s => s.distinctWeekdaysStudied >= 7),
  one('full_year_months', '🪐 Ano completo', 'Estudou em 12 meses de calendário diferentes.', s => s.distinctMonthsStudied >= 12),
  one('night_15', '🌙 Sindicato das corujas', '15 sessões depois das 22h.', s => s.lateNightSessions >= 15),
  one('dawn_15', '🌅 Clube das 6', '15 sessões antes das 7h.', s => s.earlyBirdSessions >= 15),

  // ── Modos de estudo ──
  // Checa os 3 modos ORIGINAIS especificamente (não `distinctModes >= 3`): com
  // 'mixed' como 4º modo possível, "3 distintos" passaria a aceitar combinações
  // sem flashcards puro (ex.: misturado+quiz+escrever) — perderia o sentido.
  one(
    'all_modes',
    '🔱 Tridente',
    'Estudou nos 3 modos: flashcards, quiz e escrever.',
    s =>
      s.sessionsByMode.flash > 0 &&
      s.sessionsByMode.quiz > 0 &&
      s.sessionsByMode.write > 0,
  ),
  one('quiz_25', '❓ Show do milhão', '25 sessões de quiz concluídas.', s => s.sessionsByMode.quiz >= 25),
  one('write_25', '🖋️ Datilógrafo', '25 sessões de escrever concluídas.', s => s.sessionsByMode.write >= 25),

  // ── Coleção & criação ──
  one('quizmaker_25', '🧩 Enigmista', '25 cards com alternativas de quiz criadas.', s => s.quizCardsCreated >= 25),
  one('big_deck_100', '🐳 Deck baleia', 'Um deck com 100+ cards.', s => s.biggestDeckSize >= 100),
  one('five_solid_decks', '🧱 Cinco pilares', '5 decks com 10+ cards cada.', s => s.decksWith10PlusCards >= 5),
  one('no_deck_behind', '🐑 Nenhum deck para trás', '5+ decks e todos já foram estudados.', s => s.allDecksStudied),
  one('quizified_deck', '🎯 Deck 100% quiz', 'Um deck (10+ cards) onde todos têm alternativas.', s => s.hasFullQuizDeck),
  one('multimedia_deck', '📽️ Deck multimídia', '10+ cards com imagem num mesmo deck.', s => s.maxImageCardsSameDeck >= 10),
];

if (__DEV__ && ACHIEVEMENTS.length !== 73) {
  console.warn(`[Blink] ACHIEVEMENTS deveria ter 73 itens, tem ${ACHIEVEMENTS.length}`);
}

// ── Persistência e verificação ───────────────────────────────────────────────

/**
 * Conquistas desbloqueadas do usuário — vivem no banco, por conta.
 *
 * Filtra os ids que não existem mais: reformulações anteriores deixaram
 * desbloqueios órfãos gravados (nada é apagado do banco), e contá-los daria
 * números maiores que a galeria — "22 de 73" com 9 itens acesos na lista.
 */
export async function getUnlocked(userId: string): Promise<string[]> {
  const ids = await db.achievements.getUnlocked(userId);
  const known = new Set(ACHIEVEMENTS.map(a => a.id));
  return ids.filter(id => known.has(id));
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
