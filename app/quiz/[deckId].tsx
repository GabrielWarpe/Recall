import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Deck, Flashcard } from '@/types';
import { db } from '@/services/database';
import { useStudySession } from '@/hooks/useStudySession';
import { useSettings } from '@/contexts/SettingsContext';
import { deckSupportsQuiz } from '@/utils/practice';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

const OPTION_COUNT = 4;

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * Monta as alternativas de um card: o verso correto + até 3 versos de outros
 * cards do mesmo deck (únicos e diferentes da resposta certa).
 */
function buildOptions(card: Flashcard, deck: Deck): QuizOption[] {
  const correct = card.back.trim();
  const distractors = shuffle(
    [
      ...new Set(
        deck.cards
          .filter(c => c.id !== card.id)
          .map(c => c.back.trim())
          .filter(b => b.length > 0 && b !== correct),
      ),
    ],
  ).slice(0, OPTION_COUNT - 1);

  return shuffle([
    { text: card.back, isCorrect: true },
    ...distractors.map(text => ({ text, isCorrect: false })),
  ]);
}

export default function QuizScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { settings } = useSettings();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  const session = useStudySession(deck);

  // A resposta fica AMARRADA à pergunta em que foi dada (card + progresso da
  // sessão). Assim uma seleção antiga nunca "vaza" para a pergunta seguinte,
  // mesmo com toques rápidos ou re-renderizações fora de ordem.
  const [answer, setAnswer] = useState<{ key: string; index: number } | null>(
    null,
  );
  // Cards já errados nesta sessão: ao acertar na repetição, valem "Difícil".
  const missedIdsRef = useRef<Set<string>>(new Set());
  // Momento do último avanço: ignora toques "atravessados" logo em seguida
  // (toque duplo no Próxima cairia sobre uma alternativa da pergunta nova).
  const advancedAtRef = useRef(0);
  // Última pergunta avaliada: impede avaliar a mesma pergunta duas vezes.
  const gradedKeyRef = useRef('');

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Quiz usa o deck inteiro, sempre embaralhado (modo prática).
  useEffect(() => {
    if (!deck || sessionStarted || !deckSupportsQuiz(deck)) return;
    session.start(shuffle(deck.cards));
    setSessionStarted(true);
  }, [deck, sessionStarted]);

  const currentCard = session.currentCard;
  // Identidade única da pergunta atual dentro da sessão: o mesmo card pode
  // voltar (após erro), mas done/againCount mudam a cada avaliação.
  const questionKey = currentCard
    ? `${currentCard.id}:${session.done}:${session.againCount}`
    : '';
  const options = useMemo(
    () => (currentCard && deck ? buildOptions(currentCard, deck) : []),
    [questionKey, deck],
  );

  if (!deck) return null;

  // ── Deck sem material para alternativas ──────────────────────────────────
  if (!deckSupportsQuiz(deck)) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-5xl mb-4">🧠</Text>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Quiz indisponível
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          O modo quiz precisa de pelo menos 2 cards com respostas diferentes
          para montar as alternativas.
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

  // Só vale a resposta dada NESTA pergunta; a de perguntas anteriores é nula.
  const selectedIndex = answer?.key === questionKey ? answer.index : null;
  const answered = selectedIndex !== null;
  const answeredCorrectly =
    answered && (options[selectedIndex]?.isCorrect ?? false);

  const handleSelect = (index: number) => {
    if (answered || !currentCard) return;
    // Toque logo após avançar = provável toque duplo no "Próxima"; ignora.
    if (Date.now() - advancedAtRef.current < 300) return;
    setAnswer({ key: questionKey, index });
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(
        options[index]?.isCorrect
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    }
  };

  // Aplica a avaliação só ao avançar, para o feedback ficar visível antes.
  const handleNext = () => {
    if (!currentCard || selectedIndex === null) return;
    if (gradedKeyRef.current === questionKey) return; // toque duplo
    gradedKeyRef.current = questionKey;
    advancedAtRef.current = Date.now();
    const correct = options[selectedIndex]?.isCorrect ?? false;
    setAnswer(null);
    if (correct) {
      // Acertou de primeira → "Bom"; acertou após errar → "Difícil".
      session.grade(missedIdsRef.current.has(currentCard.id) ? 'hard' : 'good');
    } else {
      missedIdsRef.current.add(currentCard.id);
      session.grade('again'); // volta ao fim da fila
    }
  };

  const handleSkip = () => {
    if (Date.now() - advancedAtRef.current < 300) return;
    advancedAtRef.current = Date.now();
    setAnswer(null);
    session.skip();
  };

  const restart = () => {
    setSessionStarted(false);
    setAnswer(null);
    missedIdsRef.current = new Set();
    advancedAtRef.current = 0;
    gradedKeyRef.current = '';
    session.reset();
    void db.decks.getOne(deck.id).then(d => {
      if (d) setDeck(d);
    });
  };

  // ── Resultado ────────────────────────────────────────────────────────────
  if (session.phase === 'finished') {
    const reviewed = session.correctCount + session.hardCount;
    const accuracy =
      reviewed > 0 ? Math.round((session.correctCount / reviewed) * 100) : 0;
    const emoji = accuracy >= 80 ? '🏆' : accuracy >= 50 ? '💪' : '📖';
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
          <Text className="text-6xl mb-4">{emoji}</Text>
          <Text className="text-on-surface font-jakarta-extrabold text-3xl text-center">
            Quiz concluído!
          </Text>
          <Text className="text-outline font-inter-regular text-base text-center mt-2">
            {deck.title}
          </Text>
          <Text className="text-on-surface-variant font-inter-medium text-sm text-center mt-3">
            {message}
          </Text>

          <View className="w-full mt-8 flex-row gap-3">
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.correctCount}
              </Text>
              <Text className="text-primary font-inter-medium text-xs mt-1">
                De primeira
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                {session.hardCount}
              </Text>
              <Text className="text-tertiary font-inter-medium text-xs mt-1">
                Recuperados
              </Text>
            </View>
            <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
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
  const progress = session.total > 0 ? session.done / session.total : 0;
  const position = Math.min(session.done + 1, session.total);
  const isLastIfCorrect = session.total - session.done === 1;

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
            🧠 {deck.title}
          </Text>
        </View>
        <View className="w-10 items-end">
          <Text className="text-outline font-inter-regular text-xs">
            {position}/{session.total}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mx-6 mb-2">
        <View className="h-1 bg-surface-container-high rounded-full overflow-hidden">
          <View
            className="h-full rounded-full bg-primary-container"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
      </View>

      {currentCard != null && (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Pergunta */}
          <View className="bg-surface-container rounded-card p-6 border border-outline-variant/20">
            <Text className="text-outline font-inter-semibold text-xs tracking-widest mb-2">
              PERGUNTA
            </Text>
            <Text className="text-on-surface font-jakarta-bold text-xl leading-7">
              {currentCard.front}
            </Text>
          </View>

          {/* Alternativas */}
          <View className="gap-3">
            {options.map((opt, i) => {
              const isSelected = selectedIndex === i;
              const showCorrect = answered && opt.isCorrect;
              const showWrong = answered && isSelected && !opt.isCorrect;
              const dimmed = answered && !isSelected && !opt.isCorrect;

              return (
                // key com a identidade da PERGUNTA: cada questão monta opções
                // novas — o TouchableOpacity anima a própria opacidade e, se
                // reutilizado entre perguntas, deixa o valor antigo "grudado".
                <TouchableOpacity
                  key={`${questionKey}:${i}`}
                  onPress={() => handleSelect(i)}
                  disabled={answered}
                  activeOpacity={0.8}
                  className={`rounded-card px-4 py-4 border ${
                    showCorrect
                      ? 'bg-green-500/15 border-green-500'
                      : showWrong
                        ? 'bg-error/15 border-error'
                        : 'bg-surface-container border-outline-variant/20'
                  }`}
                >
                  {/* Esmaecimento na View interna, fora da animação do Touchable */}
                  <View
                    className="flex-row items-center gap-3"
                    style={{ opacity: dimmed ? 0.45 : 1 }}
                  >
                    <Text
                      className={`flex-1 font-inter-medium text-base leading-6 ${
                        showCorrect
                          ? 'text-green-400'
                          : showWrong
                            ? 'text-error'
                            : 'text-on-surface'
                      }`}
                    >
                      {opt.text}
                    </Text>
                    {showCorrect && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#4ade80"
                      />
                    )}
                    {showWrong && (
                      <Ionicons
                        name="close-circle"
                        size={22}
                        color={colors.error}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feedback + ações */}
          {answered ? (
            <View className="gap-3 mt-1">
              <Text
                className={`font-inter-semibold text-sm text-center ${
                  answeredCorrectly ? 'text-green-400' : 'text-error'
                }`}
              >
                {answeredCorrectly
                  ? '✓ Correto!'
                  : '✗ Incorreto — a resposta certa está destacada. Ela voltará no fim do quiz.'}
              </Text>
              <Button variant="primary" size="lg" onPress={handleNext}>
                {answeredCorrectly && isLastIfCorrect
                  ? 'Ver resultado'
                  : 'Próxima'}
              </Button>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              className="py-2 flex-row items-center justify-center gap-1.5"
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={16}
                color={colors.outline}
              />
              <Text className="text-outline font-inter-medium text-sm">
                Pular
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
