import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Flashcard } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { buildOptions } from '@/utils/practice';
import { STRUCK_OPACITY } from '@/constants/study';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';

// Altura da imagem-destaque como fração da altura da tela — grande o
// suficiente para dar contexto visual sem empurrar as alternativas para fora.
const QUIZ_HERO_HEIGHT_RATIO = 0.42;

interface QuizQuestionProps {
  card: Flashcard;
  /**
   * Identidade única da pergunta na sessão (ex.: `${card.id}:${done}:${again}`).
   * O componente deve ser renderizado SEM prop `key` — a troca de pergunta é
   * comunicada por esta prop, e os guards anti-toque-duplo sobrevivem.
   */
  questionKey: string;
  /** true quando acertar esta pergunta encerra a sessão ("Ver resultado"). */
  isLastIfCorrect: boolean;
  /** Disparado ao confirmar em "Próxima" — o pai converte em grade SM-2. */
  onAnswer: (correct: boolean) => void;
  onSkip: () => void;
}

/**
 * Uma pergunta de quiz completa (imagem, enunciado, alternativas com
 * feedback, Próxima/Pular). Usada pela tela de quiz e pelo modo misto do
 * estudo. Toda a decisão de fila/SM-2 fica no pai, via `onAnswer`.
 */
export function QuizQuestion({
  card,
  questionKey,
  isLastIfCorrect,
  onAnswer,
  onSkip,
}: QuizQuestionProps) {
  const colors = useThemeColors();
  const { settings } = useSettings();
  const { height: screenHeight } = useWindowDimensions();

  // A resposta fica AMARRADA à pergunta em que foi dada (questionKey). Assim
  // uma seleção antiga nunca "vaza" para a pergunta seguinte, mesmo com
  // toques rápidos ou re-renderizações fora de ordem.
  const [answer, setAnswer] = useState<{ key: string; index: number } | null>(
    null,
  );
  // Alternativas eliminadas pelo usuário — apoio VISUAL apenas: riscar não
  // bloqueia responder e não entra em nenhum cálculo de acerto. Amarrado ao
  // questionKey (como `answer`), então some sozinho ao trocar de pergunta.
  const [struck, setStruck] = useState<{ key: string; indexes: number[] }>({
    key: '',
    indexes: [],
  });
  // Momento do último avanço: ignora toques "atravessados" logo em seguida
  // (toque duplo no Próxima cairia sobre uma alternativa da pergunta nova).
  const advancedAtRef = useRef(0);
  // Última pergunta avaliada: impede avaliar a mesma pergunta duas vezes.
  const gradedKeyRef = useRef('');

  const options = useMemo(
    () => buildOptions(card),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questionKey],
  );

  // Só vale a resposta dada NESTA pergunta; a de perguntas anteriores é nula.
  const selectedIndex = answer?.key === questionKey ? answer.index : null;
  const answered = selectedIndex !== null;
  const answeredCorrectly =
    answered && (options[selectedIndex]?.isCorrect ?? false);

  // Idem para os riscos: os de perguntas anteriores não valem.
  const struckIndexes = struck.key === questionKey ? struck.indexes : [];

  const toggleStrike = (index: number) => {
    setStruck(prev => {
      const current = prev.key === questionKey ? prev.indexes : [];
      return {
        key: questionKey,
        indexes: current.includes(index)
          ? current.filter(i => i !== index)
          : [...current, index],
      };
    });
  };

  const handleSelect = (index: number) => {
    if (answered) return;
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
    if (selectedIndex === null) return;
    if (gradedKeyRef.current === questionKey) return; // toque duplo
    gradedKeyRef.current = questionKey;
    advancedAtRef.current = Date.now();
    const correct = options[selectedIndex]?.isCorrect ?? false;
    setAnswer(null);
    onAnswer(correct);
  };

  const handleSkip = () => {
    if (Date.now() - advancedAtRef.current < 300) return;
    advancedAtRef.current = Date.now();
    setAnswer(null);
    onSkip();
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Imagem-destaque (só a primeira, se o card tiver imagens) */}
      {card.images.length > 0 && (
        <Image
          source={{ uri: card.images[0] }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          style={{
            width: '100%',
            height: screenHeight * QUIZ_HERO_HEIGHT_RATIO,
            borderRadius: 16,
            backgroundColor: colors.surfaceContainerHigh,
          }}
        />
      )}

      {/* Pergunta */}
      <View className="bg-surface-container rounded-card p-6" style={cardShadow}>
        <Text className="text-outline font-inter-semibold text-xs tracking-widest mb-2">
          PERGUNTA
        </Text>
        <Text className="text-on-surface font-jakarta-bold text-xl leading-7">
          {card.front}
        </Text>
      </View>

      {/* Alternativas */}
      <View className="gap-3">
        {options.map((opt, i) => {
          const isSelected = selectedIndex === i;
          const showCorrect = answered && opt.isCorrect;
          const showWrong = answered && isSelected && !opt.isCorrect;
          const dimmed = answered && !isSelected && !opt.isCorrect;
          const isStruck = struckIndexes.includes(i);

          return (
            // A alternativa e o botão de riscar são IRMÃOS, não aninhados: um
            // toque em "riscar" dentro do Touchable da opção acabaria
            // respondendo a questão.
            <View
              key={`${questionKey}:${i}`}
              className={`flex-row items-center rounded-card border ${
                showCorrect
                  ? 'bg-success/15 border-success'
                  : showWrong
                    ? 'bg-error/15 border-error'
                    : 'bg-surface-container border-outline-variant'
              }`}
            >
              <TouchableOpacity
                onPress={() => handleSelect(i)}
                disabled={answered}
                activeOpacity={0.8}
                className="flex-1 flex-row items-center gap-3 pl-4 py-4"
              >
                {/* Esmaecimento na View interna, fora da animação do Touchable */}
                <View
                  className="flex-1 flex-row items-center gap-3"
                  style={{
                    opacity: dimmed || (isStruck && !answered) ? STRUCK_OPACITY : 1,
                  }}
                >
                  <Text
                    className={`flex-1 font-inter-medium text-base leading-6 ${
                      showCorrect
                        ? 'text-success'
                        : showWrong
                          ? 'text-error'
                          : 'text-on-surface'
                    }`}
                    style={
                      isStruck ? { textDecorationLine: 'line-through' } : undefined
                    }
                  >
                    {opt.text}
                  </Text>
                  {showCorrect && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.success}
                    />
                  )}
                  {showWrong && (
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Eliminar: só antes de responder — depois quem manda é o
                  feedback certo/errado. */}
              {!answered && (
                <TouchableOpacity
                  onPress={() => toggleStrike(i)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isStruck ? 'Desfazer eliminação' : 'Eliminar alternativa'
                  }
                  className="px-4 py-4"
                >
                  <Ionicons
                    name={isStruck ? 'remove-circle' : 'remove-circle-outline'}
                    size={20}
                    color={isStruck ? colors.onSurfaceVariant : colors.outline}
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Feedback + ações */}
      {answered ? (
        <View className="gap-3 mt-1">
          <Text
            className={`font-inter-semibold text-sm text-center ${
              answeredCorrectly ? 'text-success' : 'text-error'
            }`}
          >
            {answeredCorrectly
              ? '✓ Correto!'
              : '✗ Incorreto — a resposta certa está destacada. Ela voltará no fim da sessão.'}
          </Text>
          <Button variant="primary" size="lg" onPress={handleNext}>
            {answeredCorrectly && isLastIfCorrect ? 'Ver resultado' : 'Próxima'}
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
          <Text className="text-outline font-inter-medium text-sm">Pular</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
