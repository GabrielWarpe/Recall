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
import { SwipeCard } from '@/components/SwipeCard';
import { QuizQuestion } from '@/components/QuizQuestion';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
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
  const [sessionStarted, setSessionStarted] = useState(false);
  const [noDue, setNoDue] = useState(false);

  const session = useStudySession(deck);

  // ── Modo misto (flashcards + quiz intercalados) ───────────────────────────
  // Degrada para flashcards puro se o deck não suportar quiz.
  const isMixed = mode === 'mixed' && deck != null && deckSupportsQuiz(deck);
  const mixPattern: 'alt' | 'random' = mix === 'random' ? 'random' : 'alt';
  // Cards já errados no quiz nesta sessão: acertar na repetição vale "Difícil".
  const missedIdsRef = useRef<Set<string>>(new Set());
  // Contador de APRESENTAÇÕES (inclui puladas — done/againCount não contam
  // skip, então a paridade do alternado precisa de um contador próprio).
  const presentationIndexRef = useRef(-1);
  const lastQuestionKeyRef = useRef('');

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Monta a sessão com os cards devidos + novos (limitados). Se não houver nada
  // a revisar, mostra o estado "tudo em dia" com a opção de praticar mesmo assim.
  useEffect(() => {
    if (!deck || sessionStarted || noDue) return;
    const cards = getSessionCards(deck);
    if (cards.length > 0) {
      session.start(cards);
      setSessionStarted(true);
    } else {
      setNoDue(true);
    }
  }, [deck, sessionStarted, noDue]);

  if (!deck) return null;

  const practiceAll = () => {
    setNoDue(false);
    session.start(deck.cards);
    setSessionStarted(true);
  };

  const restart = () => {
    setSessionStarted(false);
    setNoDue(false);
    missedIdsRef.current = new Set();
    presentationIndexRef.current = -1;
    lastQuestionKeyRef.current = '';
    session.reset();
    void db.decks.getOne(deck.id).then(d => {
      if (d) setDeck(d);
    });
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

  // ── Results screen ────────────────────────────────────────────────────────
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
        ? 'Perfeito! Você dominou esta revisão. 🌟'
        : accuracy >= 80
          ? 'Excelente trabalho — retenção alta!'
          : accuracy >= 50
            ? 'Bom progresso. Continue praticando!'
            : 'Todo começo é assim: repetir fixa o conteúdo.';

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
            Sessão concluída!
          </Text>
          <Text className="text-outline font-inter-regular text-base text-center mt-2">
            {deck.title}
          </Text>
          <Text className="text-on-surface-variant font-inter-medium text-sm text-center mt-3">
            {message}
          </Text>

          <View className="w-full mt-8 flex-row gap-3">
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.correctCount}
              </Text>
              <Text className="text-primary font-inter-medium text-xs mt-1">
                Acertos
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.hardCount}
              </Text>
              <Text className="text-tertiary font-inter-medium text-xs mt-1">
                Difícil
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center" style={cardShadow}>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.againCount}
              </Text>
              <Text className="text-error font-inter-medium text-xs mt-1">
                De novo
              </Text>
            </View>
          </View>

          <View className="w-full mt-6 gap-3">
            <Button variant="primary" size="lg" onPress={restart}>
              Estudar novamente
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

  // ── Active study session ──────────────────────────────────────────────────
  const progress = session.total > 0 ? session.done / session.total : 0;
  const DOT_COUNT = Math.min(session.total, 12);
  const position = Math.min(session.done + 1, session.total);

  // Identidade única da pergunta atual (o mesmo card pode voltar após erro).
  const questionKey = session.currentCard
    ? `${session.currentCard.id}:${session.done}:${session.againCount}`
    : '';
  // Conta apresentações quando a pergunta muda (skip incluso).
  if (questionKey && questionKey !== lastQuestionKeyRef.current) {
    lastQuestionKeyRef.current = questionKey;
    presentationIndexRef.current += 1;
  }

  // Formato do card do topo no misto: alternado por paridade da apresentação
  // ou sorteio estável por pergunta; card sem distrator cai para flashcard.
  const showAsQuiz =
    isMixed &&
    session.currentCard != null &&
    cardSupportsQuiz(session.currentCard) &&
    (mixPattern === 'alt'
      ? presentationIndexRef.current % 2 === 1
      : hashStr(questionKey) % 2 === 1);

  // Quiz do misto: acertou de primeira = Bom; após errar = Difícil; errou =
  // De novo (volta ao fim da fila) — mesmo mapeamento da tela de quiz.
  const handleQuizAnswer = (correct: boolean) => {
    const card = session.currentCard;
    if (!card) return;
    if (correct) {
      session.grade(missedIdsRef.current.has(card.id) ? 'hard' : 'good');
    } else {
      missedIdsRef.current.add(card.id);
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
        <View className="w-10 items-end">
          <Text className="text-outline font-inter-regular text-xs">
            {position}/{session.total}
          </Text>
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
          isLastIfCorrect={session.total - session.done === 1}
          onAnswer={handleQuizAnswer}
          onSkip={() => session.skip()}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          {session.currentCard != null && (
            <SwipeCard
              key={
                session.currentCard.id +
                '_' +
                (session.done + session.againCount)
              }
              card={session.currentCard}
              index={session.done}
              total={session.total}
              onGrade={g => session.grade(g)}
              onSkip={() => session.skip()}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
