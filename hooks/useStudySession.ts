import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Flashcard, Deck, Grade, StudyPhase, StudyMode } from '@/types';
import { reviewCard } from '@/services/ai';
import { db } from '@/services/database';
import { sessionAccuracy } from '@/utils/stats';
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
 * Resposta registrada de uma questão. Pode ser sobrescrita a qualquer momento
 * enquanto a sessão está aberta (navegação livre) — por isso o SM-2 só é
 * persistido na FINALIZAÇÃO, com a resposta definitiva de cada card.
 */
export interface CardAnswer {
  correct: boolean;
  /** Índice da alternativa escolhida (quiz) — reexibida marcada ao voltar. */
  selectedIndex?: number;
  /** Texto digitado (modo escrever) + veredito para reexibição. */
  typed?: string;
  typedVerdict?: string;
  typedOverridden?: boolean;
}

/**
 * Sessão de estudo com NAVEGAÇÃO LIVRE.
 *
 * O conjunto de cards é fixo e ordenado; o usuário anda com Anterior/Próximo e
 * cada questão guarda seu estado (sem resposta / certa / errada), que pode ser
 * alterado ao voltar. Ao finalizar:
 *  - tudo respondido → resultados direto;
 *  - há questões sem resposta → `pendingFinish` sinaliza a tela para perguntar:
 *    "Refazer questões" (rodada só com as sem resposta) ou "Deixar sem
 *    resposta" (viram Puladas e vai para os resultados).
 *
 * A % de acerto do resultado é sobre o TOTAL (puladas contam contra).
 */
export function useStudySession(deck: Deck | null, mode: StudyMode = 'flash') {
  const { user, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const [phase, setPhase] = useState<StudyPhase>('idle');

  // Conjunto fixo da sessão + mapa de respostas por card.
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [answers, setAnswers] = useState<Record<string, CardAnswer>>({});
  // Rodada de revisão ("Refazer questões"): ids das que estavam sem resposta.
  const [redoIds, setRedoIds] = useState<string[] | null>(null);
  // Posição dentro da sequência ativa (todas, ou só as da rodada de revisão).
  const [seqIndex, setSeqIndex] = useState(0);
  // Nº de questões sem resposta quando o Finalizar foi acionado (abre o modal).
  const [pendingFinish, setPendingFinish] = useState<number | null>(null);
  // Puladas (fixado na finalização — durante a sessão nada é "pulado").
  const [skippedCount, setSkippedCount] = useState(0);
  // Ordem das alternativas do quiz é derivada deste seed → estável na sessão.
  const [sessionSeed, setSessionSeed] = useState(0);

  const startTimeRef = useRef<number>(0);
  // Tempo REAL de resolução (pausa em segundo plano). É o que vai para
  // `active_seconds` — o intervalo started_at→ended_at contaria o app
  // minimizado como se fosse estudo.
  const timer = useActiveTimer();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Tempo esgotado (quiz regressivo): encerra quando o card em tela resolver,
  // tratando o que ficou sem resposta como Pulada (sem modal — não há tempo).
  const endAfterCurrentRef = useRef(false);
  // Trava contra dupla finalização (ex.: toque duplo no Finalizar).
  const finishedRef = useRef(false);

  // Ancoragem: acurácia da ÚLTIMA sessão passada deste deck, capturada quando o
  // deck fica disponível — antes de a sessão atual ser gravada, então ela não
  // se auto-compara. `null` = deck sem sessão anterior (primeira vez → sem
  // âncora, honesto). O resultado mostra o delta contra este valor.
  const [priorAccuracy, setPriorAccuracy] = useState<number | null>(null);
  useEffect(() => {
    if (!deck || !user) return;
    let cancelled = false;
    void db.sessions.getByDeck(deck.id, deck.title, 1).then(prev => {
      if (cancelled) return;
      setPriorAccuracy(prev[0] ? sessionAccuracy(prev[0]) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [deck?.id, user?.id]);

  // ── Derivados ──────────────────────────────────────────────────────────────

  /** Sequência ativa: todas as questões, ou só as da rodada de revisão. */
  const sequence = useMemo(
    () =>
      redoIds != null
        ? redoIds
            .map(id => cards.find(c => c.id === id))
            .filter((c): c is Flashcard => c != null)
        : cards,
    [cards, redoIds],
  );

  const currentCard =
    phase === 'studying' ? (sequence[seqIndex] ?? null) : null;
  const currentAnswer = currentCard ? (answers[currentCard.id] ?? null) : null;

  const answeredCount = useMemo(
    () => cards.reduce((n, c) => n + (answers[c.id] ? 1 : 0), 0),
    [cards, answers],
  );
  const correctCount = useMemo(
    () => cards.reduce((n, c) => n + (answers[c.id]?.correct ? 1 : 0), 0),
    [cards, answers],
  );
  const againCount = answeredCount - correctCount;
  const unansweredCount = cards.length - answeredCount;

  /** Ids que não foram "Entendi" (erradas ou puladas) — base do "refazer". */
  const wrongIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of cards) {
      const a = answers[c.id];
      if (phase === 'finished' ? !a?.correct : a != null && !a.correct) {
        s.add(c.id);
      }
    }
    return s;
  }, [cards, answers, phase]);

  const canPrev = seqIndex > 0;
  const canNext = seqIndex < sequence.length - 1;
  const isLastPosition = seqIndex >= sequence.length - 1;

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  const start = useCallback(
    (studyCards: Flashcard[]) => {
      const ordered = settings.shuffle
        ? [...studyCards].sort(() => Math.random() - 0.5)
        : [...studyCards];
      // Baixa as imagens da sessão de antemão: quando o card chegar ao topo,
      // ela já está no cache do expo-image e aparece na hora.
      prefetchCardImages(ordered);
      setCards(ordered);
      setAnswers({});
      setRedoIds(null);
      setSeqIndex(0);
      setPendingFinish(null);
      setSkippedCount(0);
      setSessionSeed(Math.floor(Math.random() * 0x7fffffff));
      setPhase('studying');
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      endAfterCurrentRef.current = false;
      finishedRef.current = false;
      timer.start();
    },
    [settings.shuffle, timer],
  );

  /**
   * Encerra a sessão: persiste o SM-2 de cada questão RESPONDIDA (uma única
   * vez, com a resposta definitiva), grava a sessão e roda o pós-processo
   * (streak, conquistas, lembretes). Puladas não geram revisão SM-2.
   */
  const complete = useCallback(
    (finalAnswers: Record<string, CardAnswer>, allCards: Flashcard[]) => {
      if (finishedRef.current) return;
      finishedRef.current = true;

      // Para o cronômetro antes de qualquer await: o tempo é o da resolução,
      // não o da gravação.
      const activeSeconds = timer.stop();
      setElapsedSeconds(activeSeconds);

      const answered = allCards.filter(c => finalAnswers[c.id] != null);
      const correct = answered.filter(c => finalAnswers[c.id]!.correct).length;
      const again = answered.length - correct;
      setSkippedCount(allCards.length - answered.length);
      setPendingFinish(null);

      if (deck && user && answered.length > 0) {
        const startedAt = new Date(startTimeRef.current).toISOString();
        void (async () => {
          // SM-2 com a resposta DEFINITIVA de cada card (a navegação livre
          // permite trocar a resposta, então nada foi gravado antes daqui).
          for (const card of answered) {
            const g: Grade = finalAnswers[card.id]!.correct ? 'good' : 'again';
            const updated = reviewCard(card, g);
            await db.decks.reviewCard(updated);
            await db.reviews.log({
              user_id: user.id,
              card_id: card.id,
              playlist_id: deck.id,
              grade: g,
              interval_before: card.interval,
              interval_after: updated.interval,
            });
          }

          await db.sessions.create({
            user_id: user.id,
            playlist_id: deck.id,
            started_at: startedAt,
            ended_at: new Date().toISOString(),
            cards_reviewed: answered.length,
            correct_count: correct,
            // A avaliação é binária: 'Difícil' não existe mais. A coluna fica
            // (sessões antigas a usam), sempre zerada nas novas.
            hard_count: 0,
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

  // ── Navegação ──────────────────────────────────────────────────────────────

  const next = useCallback(() => {
    setSeqIndex(i => Math.min(i + 1, Math.max(sequence.length - 1, 0)));
  }, [sequence.length]);

  const prev = useCallback(() => {
    setSeqIndex(i => Math.max(i - 1, 0));
  }, []);

  // ── Respostas ──────────────────────────────────────────────────────────────

  /**
   * Registra (ou sobrescreve) a resposta da questão atual. NÃO navega — quem
   * decide avançar é a tela (quiz/escrever têm o botão "Próxima"; flashcards
   * usam `answerAndAdvance`).
   */
  const answer = useCallback(
    (correct: boolean, detail?: Omit<CardAnswer, 'correct'>) => {
      const card = sequence[seqIndex];
      if (!card) return;
      setAnswers(prevA => ({ ...prevA, [card.id]: { correct, ...detail } }));
    },
    [sequence, seqIndex],
  );

  /** Limpa a resposta da questão atual (o "trocar resposta" do quiz/escrever). */
  const clearAnswer = useCallback(() => {
    const card = sequence[seqIndex];
    if (!card) return;
    setAnswers(prevA => {
      const nextA = { ...prevA };
      delete nextA[card.id];
      return nextA;
    });
  }, [sequence, seqIndex]);

  /**
   * Finaliza a sessão. Tudo respondido (ou `force`) → resultados; senão,
   * sinaliza `pendingFinish` para a tela perguntar o que fazer com as
   * questões sem resposta.
   */
  const finish = useCallback(
    (opts?: { force?: boolean; withAnswers?: Record<string, CardAnswer> }) => {
      const finalAnswers = opts?.withAnswers ?? answers;
      const unanswered = cards.filter(c => finalAnswers[c.id] == null).length;
      if (unanswered === 0 || opts?.force) {
        complete(finalAnswers, cards);
      } else {
        setPendingFinish(unanswered);
      }
    },
    [answers, cards, complete],
  );

  /**
   * Registra a resposta e segue o fluxo dos flashcards: avança para a próxima;
   * na última posição (ou tempo esgotado), aciona a finalização.
   */
  const answerAndAdvance = useCallback(
    (correct: boolean, detail?: Omit<CardAnswer, 'correct'>) => {
      const card = sequence[seqIndex];
      if (!card) return;
      const nextAnswers: Record<string, CardAnswer> = {
        ...answers,
        [card.id]: { correct, ...detail },
      };
      setAnswers(nextAnswers);

      if (endAfterCurrentRef.current) {
        // Tempo esgotado: sem modal — o que ficou sem resposta vira Pulada.
        complete(nextAnswers, cards);
        return;
      }

      if (redoIds != null) {
        // Rodada de revisão: pula para a próxima ainda sem resposta; acabou →
        // resultados automáticos (espírito do "Refazer questões").
        const remaining = cards.filter(c => nextAnswers[c.id] == null);
        if (remaining.length === 0) {
          complete(nextAnswers, cards);
          return;
        }
        const after = sequence.findIndex(
          (c, i) => i > seqIndex && nextAnswers[c.id] == null,
        );
        const anywhere = sequence.findIndex(c => nextAnswers[c.id] == null);
        setSeqIndex(after !== -1 ? after : anywhere !== -1 ? anywhere : 0);
        return;
      }

      if (seqIndex >= sequence.length - 1) {
        // Última questão respondida: finaliza (direto ou via modal).
        const unanswered = cards.filter(c => nextAnswers[c.id] == null).length;
        if (unanswered === 0) complete(nextAnswers, cards);
        else setPendingFinish(unanswered);
      } else {
        setSeqIndex(seqIndex + 1);
      }
    },
    [answers, cards, sequence, seqIndex, redoIds, complete],
  );

  /** "Refazer questões": rodada apenas com as que estão sem resposta. */
  const redoUnanswered = useCallback(() => {
    const ids = cards.filter(c => answers[c.id] == null).map(c => c.id);
    if (ids.length === 0) {
      complete(answers, cards);
      return;
    }
    setRedoIds(ids);
    setSeqIndex(0);
    setPendingFinish(null);
  }, [cards, answers, complete]);

  /** "Deixar sem resposta": as sem resposta viram Puladas → resultados. */
  const leaveUnanswered = useCallback(() => {
    finish({ force: true });
  }, [finish]);

  /**
   * Tempo esgotado (quiz regressivo): a questão em tela ainda vale; a sessão
   * encerra quando ela for resolvida, com as restantes como Puladas.
   */
  const requestFinish = useCallback(() => {
    endAfterCurrentRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setCards([]);
    setAnswers({});
    setRedoIds(null);
    setSeqIndex(0);
    setPendingFinish(null);
    setSkippedCount(0);
    setElapsedSeconds(0);
    endAfterCurrentRef.current = false;
    finishedRef.current = false;
  }, []);

  return {
    phase,
    /** Conjunto fixo da sessão (ordem estável — paridade do misto usa isto). */
    cards,
    currentCard,
    /** Resposta salva da questão atual (null = sem resposta). */
    currentAnswer,
    /** Posição 1-based e tamanho da sequência ativa (rodada de revisão conta só as dela). */
    position: Math.min(seqIndex + 1, Math.max(sequence.length, 1)),
    sequenceLength: sequence.length,
    /** Nº de questões já respondidas (barra de progresso). */
    done: answeredCount,
    total: cards.length,
    correctCount,
    againCount,
    unansweredCount,
    /** Puladas (fixado na finalização). */
    skippedCount,
    /** Ids errados/pulados — base do "praticar as que não entendi". */
    wrongIds,
    /** Tempo final da sessão (só preenchido depois de terminar). */
    elapsedSeconds,
    /** Acurácia da última sessão passada do deck (ancoragem); null se 1ª vez. */
    priorAccuracy,
    /** Seed da sessão: mantém a ordem das alternativas do quiz estável. */
    sessionSeed,
    /** Rodada "Refazer questões" ativa? */
    inRedoRound: redoIds != null,
    /** > 0 → a tela deve perguntar o que fazer com as questões sem resposta. */
    pendingFinish,
    canPrev,
    canNext,
    isLastPosition,
    /** Lê o tempo corrente sem re-renderizar — para o relógio da tela. */
    getElapsed: timer.getElapsed,
    start,
    answer,
    answerAndAdvance,
    clearAnswer,
    next,
    prev,
    finish,
    redoUnanswered,
    leaveUnanswered,
    requestFinish,
    reset,
  };
}
