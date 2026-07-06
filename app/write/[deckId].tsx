import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Deck, Flashcard } from '@/types';
import { db } from '@/services/database';
import { useStudySession } from '@/hooks/useStudySession';
import { useSettings } from '@/contexts/SettingsContext';
import { checkAnswer, type AnswerVerdict } from '@/utils/answer';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** Resultado da pergunta atual, amarrado à identidade dela (como no quiz). */
interface WriteResult {
  key: string;
  verdict: AnswerVerdict | 'idk';
  input: string;
  overridden?: boolean;
}

export default function WriteScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { settings } = useSettings();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);

  const session = useStudySession(deck);

  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<WriteResult | null>(null);
  const missedIdsRef = useRef<Set<string>>(new Set());
  const advancedAtRef = useRef(0);
  const gradedKeyRef = useRef('');

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Modo prática: deck inteiro, sempre embaralhado.
  useEffect(() => {
    if (!deck || sessionStarted || deck.cards.length === 0) return;
    session.start(shuffle(deck.cards));
    setSessionStarted(true);
  }, [deck, sessionStarted]);

  const currentCard: Flashcard | null = session.currentCard;
  const questionKey = currentCard
    ? `${currentCard.id}:${session.done}:${session.againCount}`
    : '';

  // Só vale o resultado desta pergunta.
  const currentResult = result?.key === questionKey ? result : null;
  const isCorrect =
    currentResult != null &&
    (currentResult.verdict === 'exact' ||
      currentResult.verdict === 'typo' ||
      currentResult.overridden === true);

  if (!deck) return null;

  // ── Deck vazio ───────────────────────────────────────────────────────────
  if (deck.cards.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-5xl mb-4">✍️</Text>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Deck vazio
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Adicione cards a este deck para praticar escrevendo.
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

  const handleVerify = () => {
    if (!currentCard || currentResult != null) return;
    const input = draft.trim();
    if (input.length === 0) return;
    Keyboard.dismiss();
    const verdict = checkAnswer(input, currentCard.back);
    setResult({ key: questionKey, verdict, input });
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(
        verdict === 'wrong'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );
    }
  };

  const handleDontKnow = () => {
    if (!currentCard || currentResult != null) return;
    if (Date.now() - advancedAtRef.current < 300) return;
    Keyboard.dismiss();
    setResult({ key: questionKey, verdict: 'idk', input: draft.trim() });
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // "Na verdade acertei" — para sinônimos/formulações equivalentes.
  const handleOverride = () => {
    if (!currentResult || currentResult.verdict !== 'wrong') return;
    setResult({ ...currentResult, overridden: true });
  };

  const handleNext = () => {
    if (!currentCard || !currentResult) return;
    if (gradedKeyRef.current === questionKey) return; // toque duplo
    gradedKeyRef.current = questionKey;
    advancedAtRef.current = Date.now();
    setResult(null);
    setDraft('');
    if (isCorrect) {
      session.grade(missedIdsRef.current.has(currentCard.id) ? 'hard' : 'good');
    } else {
      missedIdsRef.current.add(currentCard.id);
      session.grade('again'); // volta ao fim da fila
    }
  };

  const restart = () => {
    setSessionStarted(false);
    setResult(null);
    setDraft('');
    missedIdsRef.current = new Set();
    advancedAtRef.current = 0;
    gradedKeyRef.current = '';
    session.reset();
    void db.decks.getOne(deck.id).then(d => {
      if (d) setDeck(d);
    });
  };

  // ── Resultado final ──────────────────────────────────────────────────────
  if (session.phase === 'finished') {
    const reviewed = session.correctCount + session.hardCount;
    const accuracy =
      reviewed > 0 ? Math.round((session.correctCount / reviewed) * 100) : 0;
    const emoji = accuracy >= 80 ? '🏆' : accuracy >= 50 ? '💪' : '📖';
    const message =
      accuracy >= 100
        ? 'Perfeito! Você escreveu tudo certo. 🌟'
        : accuracy >= 80
          ? 'Excelente! Escrever é o jeito mais forte de fixar.'
          : accuracy >= 50
            ? 'Bom treino. Os erros voltaram até você acertar!'
            : 'Escrever é difícil mesmo — e é por isso que funciona.';

    return (
      <SafeAreaView className="flex-1 bg-background px-8">
        <View className="flex-1 items-center justify-center">
          <Text className="text-6xl mb-4">{emoji}</Text>
          <Text className="text-on-surface font-jakarta-extrabold text-3xl text-center">
            Prática concluída!
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
              Praticar de novo
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
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
              ✍️ {deck.title}
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Pergunta */}
            <View className="bg-surface-container rounded-card p-6 border border-outline-variant/20">
              <Text className="text-outline font-inter-semibold text-xs tracking-widest mb-2">
                ESCREVA A RESPOSTA
              </Text>
              <Text className="text-on-surface font-jakarta-bold text-xl leading-7">
                {currentCard.front}
              </Text>
            </View>

            {currentResult == null ? (
              <>
                {/* Campo de resposta */}
                <TextInput
                  key={questionKey}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={handleVerify}
                  placeholder="Digite sua resposta..."
                  placeholderTextColor={colors.outline}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  className="bg-surface-container rounded-card px-4 py-4 text-on-surface font-inter-regular text-base border border-outline-variant/30"
                  selectionColor={colors.primary}
                />
                <Button
                  variant="primary"
                  size="lg"
                  disabled={draft.trim().length === 0}
                  onPress={handleVerify}
                >
                  Verificar
                </Button>
                <TouchableOpacity
                  onPress={handleDontKnow}
                  activeOpacity={0.7}
                  className="py-1 items-center"
                >
                  <Text className="text-outline font-inter-medium text-sm">
                    Não sei
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Feedback */}
                <View
                  className={`rounded-card p-4 border ${
                    isCorrect
                      ? 'bg-green-500/15 border-green-500'
                      : 'bg-error/15 border-error'
                  }`}
                >
                  <Text
                    className={`font-inter-semibold text-sm ${
                      isCorrect ? 'text-green-400' : 'text-error'
                    }`}
                  >
                    {currentResult.overridden
                      ? '✓ Marcado como certo'
                      : currentResult.verdict === 'exact'
                        ? '✓ Correto!'
                        : currentResult.verdict === 'typo'
                          ? '✓ Quase perfeito — só um errinho de digitação'
                          : currentResult.verdict === 'idk'
                            ? 'Sem problema — a resposta era:'
                            : '✗ Não foi dessa vez. A resposta era:'}
                  </Text>
                  <Text className="text-on-surface font-jakarta-bold text-base mt-2 leading-6">
                    {currentCard.back}
                  </Text>
                  {currentResult.verdict === 'wrong' &&
                    currentResult.input.length > 0 && (
                      <Text className="text-outline font-inter-regular text-xs mt-2">
                        Você escreveu: “{currentResult.input}”
                      </Text>
                    )}
                </View>

                {currentResult.verdict === 'wrong' &&
                  !currentResult.overridden && (
                    <TouchableOpacity
                      onPress={handleOverride}
                      activeOpacity={0.7}
                      className="py-1 items-center"
                    >
                      <Text className="text-primary font-inter-medium text-sm">
                        Minha resposta estava certa
                      </Text>
                    </TouchableOpacity>
                  )}

                <Button variant="primary" size="lg" onPress={handleNext}>
                  {isCorrect && isLastIfCorrect ? 'Ver resultado' : 'Próxima'}
                </Button>
                {!isCorrect && (
                  <Text className="text-outline font-inter-regular text-xs text-center">
                    Este card volta no fim da prática.
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
