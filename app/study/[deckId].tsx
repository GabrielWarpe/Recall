import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Deck } from '@/types';
import { db } from '@/services/database';
import { getSessionCards } from '@/services/ai';
import { useStudySession } from '@/hooks/useStudySession';
import { useTimedSession } from '@/hooks/useTimedSession';
import { deckSupportsQuiz, cardSupportsQuiz } from '@/utils/practice';
import { SwipeCard } from '@/components/SwipeCard';
import { QuizQuestion } from '@/components/QuizQuestion';
import { SessionTimer } from '@/components/SessionTimer';
import { StudySetup } from '@/components/StudySetup';
import { SessionResult } from '@/components/SessionResult';
import { TimeUpNotice, TIME_UP_MESSAGE } from '@/components/TimeUpNotice';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

/** Hash determinístico (djb2) — sorteio de formato estável por pergunta. */
function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function StudySessionScreen() {
  const { deckId, mode, mix } = useLocalSearchParams<{
    deckId: string;
    mode?: string;
    mix?: string;
  }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [noDue, setNoDue] = useState(false);

  const session = useStudySession(deck);
  // Cronômetro + tela de início: mesma lógica de todos os modos.
  const timed = useTimedSession(session);

  // ── Modo misto (flashcards + quiz intercalados) ───────────────────────────
  // Degrada para flashcards puro se o deck não suportar quiz.
  const isMixed = mode === 'mixed' && deck != null && deckSupportsQuiz(deck);
  const mixPattern: 'alt' | 'random' = mix === 'random' ? 'random' : 'alt';

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Monta a sessão com os cards devidos + novos (limitados). Se não houver nada
  // a revisar, mostra o estado "tudo em dia" com a opção de praticar mesmo assim.
  // Os cards ficam PENDENTES: quem inicia é a tela de início.
  useEffect(() => {
    if (!deck || timed.started || noDue || timed.pending) return;
    const cards = getSessionCards(deck);
    if (cards.length > 0) timed.prepare(cards);
    else setNoDue(true);
  }, [deck, noDue, timed.started, timed.pending, timed.prepare]);

  if (!deck) return null;

  const practiceAll = () => {
    setNoDue(false);
    timed.prepare(deck.cards);
  };

  // 'all' = revisar o deck inteiro de novo; 'wrong' = só as que errei nesta
  // sessão. Os ids errados são lidos ANTES do reset (que os limpa) e a
  // preparação síncrona evita a corrida com o auto-prepare.
  const restart = (scope: 'all' | 'wrong') => {
    const wrong = session.wrongIds;
    const cards =
      scope === 'wrong' ? deck.cards.filter(c => wrong.has(c.id)) : deck.cards;
    setNoDue(false);
    timed.resetTimed();
    timed.prepare(cards);
  };

  // ── Deck sem cards ───────────────────────────────────────────────────────
  if (deck.cards.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.primary + '22' }}
        >
          <Ionicons name="file-tray-outline" size={34} color={colors.primary} />
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Deck vazio
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Adicione cards a este deck para poder estudá-lo.
        </Text>
        <Button
          variant="primary"
          size="lg"
          className="mt-8 w-full"
          onPress={() => router.back()}
        >
          Voltar
        </Button>
      </SafeAreaView>
    );
  }

  // ── Tudo em dia (nada devido) ─────────────────────────────────────────────
  if (noDue && session.phase !== 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.success + '22' }}
        >
          <Ionicons name="checkmark-done" size={36} color={colors.success} />
        </View>
        <Text className="text-on-surface font-jakarta-extrabold text-2xl text-center">
          Tudo em dia!
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Você não tem cards para revisar neste deck agora. Volte mais tarde ou
          pratique mesmo assim.
        </Text>
        <View className="w-full mt-8 gap-3">
          <Button variant="primary" size="lg" onPress={practiceAll}>
            Praticar tudo
          </Button>
          <Button variant="outline" size="lg" onPress={() => router.back()}>
            Voltar
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Tela de início (config do cronômetro desta sessão) ────────────────────
  if (timed.showSetup && session.phase !== 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StudySetup
          modeLabel={isMixed ? 'Alternado' : 'Estudo'}
          modeIcon={isMixed ? 'shuffle' : 'layers'}
          deckTitle={deck.title}
          cardCount={timed.pending?.length ?? 0}
          config={timed.config}
          onChange={timed.setConfig}
          onStart={timed.begin}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (session.phase === 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <SessionResult
          deckTitle={deck.title}
          correct={session.correctCount}
          wrong={session.againCount}
          skipped={session.skippedCount}
          seconds={session.elapsedSeconds}
          showTime={timed.config.enabled}
          redoCount={session.wrongIds.size}
          onRedo={restart}
          onExit={() => router.back()}
          onAchievements={() => router.replace('/achievements')}
        />
      </SafeAreaView>
    );
  }

  // ── Active study session ──────────────────────────────────────────────────
  const progress = session.total > 0 ? session.done / session.total : 0;
  const DOT_COUNT = Math.min(session.total, 12);
  const position = Math.min(session.done + 1, session.total);

  // Identidade única da pergunta atual.
  const questionKey = session.currentCard
    ? `${session.currentCard.id}:${session.done}:${session.againCount}`
    : '';

  // Formato do card do topo no misto: alternado pela paridade de `done` (nº de
  // cards já processados — uma passada, então cada card avança `done` em 1) ou
  // sorteio estável por pergunta; card sem distrator cai para flashcard.
  // Usar `done` em vez de um ref mutado no render deixa o "Desfazer" coerente:
  // ao voltar, a paridade acompanha, sem dessincronizar a alternância.
  const showAsQuiz =
    isMixed &&
    session.currentCard != null &&
    cardSupportsQuiz(session.currentCard) &&
    (mixPattern === 'alt'
      ? session.done % 2 === 1
      : hashStr(questionKey) % 2 === 1);

  // Acertou ou errou (uma passada — o card sai da fila).
  const handleQuizAnswer = (correct: boolean) => {
    session.answer(correct);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View className="flex-1 mx-2">
          <Text
            className="text-on-surface font-jakarta-semibold text-base text-center"
            numberOfLines={1}
          >
            {deck.title}
          </Text>
        </View>
        <View className="items-end gap-0.5">
          <Text className="text-outline font-inter-regular text-xs">
            {position}/{session.total}
          </Text>
          {/* Cronômetro desligado ou oculto → sem mostrador. Oculto, o tempo
              continua correndo e sendo gravado (a medição vive na sessão). */}
          {timed.showClock && (
            <SessionTimer
              getDisplay={timed.getDisplay}
              running={session.phase === 'studying'}
              phase={timed.phase}
              countdown={timed.isCountdown}
            />
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View className="mx-5 mb-2">
        <View className="h-1 bg-surface-container-high rounded-pill overflow-hidden">
          <View
            className="h-full rounded-pill bg-primary"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      </View>

      {/* Progress dots */}
      <View className="flex-row justify-center gap-1.5 py-2">
        {Array.from({ length: DOT_COUNT }).map((_, i) => {
          const threshold = Math.floor((i / DOT_COUNT) * session.total);
          const isDone = session.done > threshold;
          const isActive =
            session.done >= threshold &&
            session.done < Math.floor(((i + 1) / DOT_COUNT) * session.total);
          return (
            <View
              key={i}
              className="h-1.5 rounded-pill"
              style={{
                width: isDone || isActive ? 20 : 12,
                backgroundColor: isDone
                  ? colors.primary
                  : isActive
                    ? colors.primaryContainer
                    : colors.surfaceContainerHighest,
              }}
            />
          );
        })}
      </View>

      {/* Card area */}
      {showAsQuiz && session.currentCard != null ? (
        // SEM prop `key`: a troca de pergunta é comunicada pelo questionKey e
        // os guards anti-toque-duplo internos sobrevivem entre perguntas.
        <QuizQuestion
          card={session.currentCard}
          questionKey={questionKey}
          isLast={session.total - session.done === 1 || timed.expired}
          notice={timed.expired ? TIME_UP_MESSAGE : undefined}
          onAnswer={handleQuizAnswer}
          onSkip={() => session.skip()}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          {/* Tempo esgotado: o card em tela ainda vale; a sessão encerra depois
              de avaliá-lo ou pulá-lo. */}
          {timed.expired && <TimeUpNotice className="mb-4 w-full" />}
          {session.currentCard != null && (
            <SwipeCard
              key={
                session.currentCard.id +
                '_' +
                (session.done + session.againCount)
              }
              card={session.currentCard}
              onAnswer={correct => session.answer(correct)}
              onBack={() => session.back()}
              canGoBack={session.canGoBack}
              wrongCount={session.againCount}
              rightCount={session.correctCount}
              onSkip={() => session.skip()}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
