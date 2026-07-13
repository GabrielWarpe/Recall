import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Deck } from '@/types';
import { db } from '@/services/database';
import { getSessionCards } from '@/services/ai';
import { useStudySession } from '@/hooks/useStudySession';
import { deckSupportsQuiz, cardSupportsQuiz } from '@/utils/practice';
import { QuizQuestion } from '@/components/QuizQuestion';
import { QuizTimer } from '@/components/QuizTimer';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { formatClock } from '@/utils/stats';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function QuizScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [noDue, setNoDue] = useState(false);

  const session = useStudySession(deck, 'quiz');

  // Cards já errados nesta sessão: ao acertar na repetição, valem "Difícil".
  const missedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Mesma seleção do estudo (devidos + novos), restrita aos cards que TÊM
  // alternativas autoradas — só eles são perguntas de quiz. O quiz também
  // conta para o agendamento SM-2. Sem nada devido → "Tudo em dia".
  useEffect(() => {
    if (!deck || sessionStarted || noDue || !deckSupportsQuiz(deck)) return;
    const cards = getSessionCards(deck).filter(cardSupportsQuiz);
    if (cards.length > 0) {
      session.start(cards);
      setSessionStarted(true);
    } else {
      setNoDue(true);
    }
  }, [deck, sessionStarted, noDue]);

  const practiceAll = () => {
    if (!deck) return;
    setNoDue(false);
    session.start(deck.cards.filter(cardSupportsQuiz));
    setSessionStarted(true);
  };

  const restart = () => {
    setSessionStarted(false);
    setNoDue(false);
    missedIdsRef.current = new Set();
    session.reset();
    if (deck) {
      void db.decks.getOne(deck.id).then(d => {
        if (d) setDeck(d);
      });
    }
  };

  if (!deck) return null;

  // ── Deck sem material para alternativas ──────────────────────────────────
  if (!deckSupportsQuiz(deck)) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.primary + '22' }}
        >
          <Ionicons name="help-circle-outline" size={36} color={colors.primary} />
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Quiz indisponível
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Nenhum card deste deck tem alternativas de quiz. Edite um card e
          adicione pelo menos 2 alternativas erradas para criar a pergunta.
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

  // ── Resultado ────────────────────────────────────────────────────────────
  if (session.phase === 'finished') {
    const reviewed = session.correctCount + session.hardCount;
    const accuracy =
      reviewed > 0 ? Math.round((session.correctCount / reviewed) * 100) : 0;
    const resultIcon =
      accuracy >= 80 ? 'trophy' : accuracy >= 50 ? 'trending-up' : 'book';
    const resultTint =
      accuracy >= 80
        ? colors.tertiary
        : accuracy >= 50
          ? colors.primary
          : colors.info;
    const message =
      accuracy >= 100
        ? 'Perfeito! Nenhum erro no quiz. 🌟'
        : accuracy >= 80
          ? 'Excelente! Quase tudo de primeira.'
          : accuracy >= 50
            ? 'Bom quiz. Os erros voltaram até você acertar!'
            : 'Errar faz parte: repetir é o que fixa o conteúdo.';

    return (
      <SafeAreaView className="flex-1 bg-background px-8">
        <View className="flex-1 items-center justify-center">
          <View
            className="w-20 h-20 rounded-card items-center justify-center mb-5"
            style={{ backgroundColor: resultTint + '22' }}
          >
            <Ionicons name={resultIcon} size={38} color={resultTint} />
          </View>
          <Text className="text-on-surface font-jakarta-extrabold text-3xl text-center">
            Quiz concluído!
          </Text>
          <Text className="text-outline font-inter-regular text-base text-center mt-2">
            {deck.title}
          </Text>

          {/* Tempo total de resolução (só o tempo com o app aberto). */}
          <View className="flex-row items-center gap-1.5 mt-3">
            <Ionicons name="time-outline" size={15} color={colors.outline} />
            <Text
              className="text-outline font-inter-medium text-sm"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatClock(session.elapsedSeconds)}
            </Text>
          </View>

          <Text className="text-on-surface-variant font-inter-medium text-sm text-center mt-3">
            {message}
          </Text>

          <View className="w-full mt-8 flex-row gap-3">
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.correctCount}
              </Text>
              <Text className="text-primary font-inter-medium text-xs mt-1">
                De primeira
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.hardCount}
              </Text>
              <Text className="text-tertiary font-inter-medium text-xs mt-1">
                Recuperados
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {accuracy}%
              </Text>
              <Text className="text-error font-inter-medium text-xs mt-1">
                Precisão
              </Text>
            </View>
          </View>

          <View className="w-full mt-6 gap-3">
            <Button variant="primary" size="lg" onPress={restart}>
              Refazer quiz
            </Button>
            <Button variant="outline" size="lg" onPress={() => router.back()}>
              Voltar
            </Button>
          </View>

          <TouchableOpacity
            className="mt-5 flex-row items-center gap-1.5"
            activeOpacity={0.7}
            onPress={() => router.replace('/achievements')}
          >
            <Ionicons name="trophy-outline" size={16} color={colors.tertiary} />
            <Text className="text-outline font-inter-medium text-sm">
              Ver conquistas
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Pergunta ativa ───────────────────────────────────────────────────────
  const currentCard = session.currentCard;
  // Identidade única da pergunta atual dentro da sessão: o mesmo card pode
  // voltar (após erro), mas done/againCount mudam a cada avaliação.
  const questionKey = currentCard
    ? `${currentCard.id}:${session.done}:${session.againCount}`
    : '';
  const progress = session.total > 0 ? session.done / session.total : 0;
  const position = Math.min(session.done + 1, session.total);
  const isLastIfCorrect = session.total - session.done === 1;

  // Acertou de primeira → "Bom"; acertou após errar → "Difícil"; errou →
  // "De novo" (o card volta ao fim da fila).
  const handleAnswer = (correct: boolean) => {
    if (!currentCard) return;
    if (correct) {
      session.grade(missedIdsRef.current.has(currentCard.id) ? 'hard' : 'good');
    } else {
      missedIdsRef.current.add(currentCard.id);
      session.grade('again');
    }
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
          <QuizTimer
            getElapsed={session.getElapsed}
            running={session.phase === 'studying'}
          />
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

      {currentCard != null && (
        // SEM prop `key`: a troca de pergunta é comunicada pelo questionKey e
        // os guards anti-toque-duplo internos sobrevivem entre perguntas.
        <QuizQuestion
          card={currentCard}
          questionKey={questionKey}
          isLastIfCorrect={isLastIfCorrect}
          onAnswer={handleAnswer}
          onSkip={() => session.skip()}
        />
      )}
    </SafeAreaView>
  );
}
