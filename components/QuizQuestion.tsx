import React, { useMemo, useState } from 'react';
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
import { TimeUpNotice } from '@/components/TimeUpNotice';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';

// Altura da imagem-destaque como fração da altura da tela — grande o
// suficiente para dar contexto visual sem empurrar as alternativas para fora.
const QUIZ_HERO_HEIGHT_RATIO = 0.42;

interface QuizQuestionProps {
  card: Flashcard;
  /**
   * Seed da sessão: a ordem das alternativas é derivada de card+seed e fica
   * ESTÁVEL — voltar a uma questão respondida reexibe a mesma ordem, então o
   * índice salvo aponta para a alternativa certa.
   */
  seed: number;
  /** Alternativa já escolhida (salva na sessão); null = sem resposta. */
  savedIndex: number | null;
  /** Última posição da sequência → o botão vira "Finalizar". */
  isLastPosition: boolean;
  /** Aviso destacado acima da pergunta (ex.: "Tempo esgotado"). */
  notice?: string;
  /** Escolha confirmada: registra a resposta (correct + índice) na sessão. */
  onSelect: (correct: boolean, index: number) => void;
  /** "Trocar resposta": limpa a resposta salva desta questão. */
  onClearAnswer: () => void;
  /** Navegação livre. */
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  canPrev: boolean;
}

/**
 * Uma pergunta de quiz completa (imagem, enunciado, alternativas com feedback
 * e navegação Anterior/Próxima). CONTROLADA: a resposta vive na sessão
 * (`savedIndex`), então revisitar a questão mostra a escolha marcada e o
 * usuário pode trocá-la. Usada pela tela de quiz e pelo modo misto do estudo.
 */
export function QuizQuestion({
  card,
  seed,
  savedIndex,
  isLastPosition,
  notice,
  onSelect,
  onClearAnswer,
  onPrev,
  onNext,
  onFinish,
  canPrev,
}: QuizQuestionProps) {
  const colors = useThemeColors();
  const { settings } = useSettings();
  const { height: screenHeight } = useWindowDimensions();

  // Ordem estável por card+seed (ver doc da prop `seed`).
  const options = useMemo(() => buildOptions(card, seed), [card.id, seed]);

  // Alternativas eliminadas pelo usuário — apoio VISUAL apenas: riscar não
  // bloqueia responder e não entra em nenhum cálculo. Amarrado ao card.
  const [struck, setStruck] = useState<{ id: string; indexes: number[] }>({
    id: '',
    indexes: [],
  });
  const struckIndexes = struck.id === card.id ? struck.indexes : [];

  const answered = savedIndex != null;
  const answeredCorrectly =
    answered && (options[savedIndex]?.isCorrect ?? false);

  const toggleStrike = (index: number) => {
    setStruck(prev => {
      const current = prev.id === card.id ? prev.indexes : [];
      return {
        id: card.id,
        indexes: current.includes(index)
          ? current.filter(i => i !== index)
          : [...current, index],
      };
    });
  };

  const handleSelect = (index: number) => {
    if (answered) return;
    const correct = options[index]?.isCorrect ?? false;
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(
        correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    }
    onSelect(correct, index);
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 24, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Aviso (ex.: tempo esgotado). Não bloqueia nada — a questão em tela
          ainda pode ser respondida. */}
      {notice != null && <TimeUpNotice message={notice} />}

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
          const isSelected = savedIndex === i;
          const showCorrect = answered && opt.isCorrect;
          const showWrong = answered && isSelected && !opt.isCorrect;
          const dimmed = answered && !isSelected && !opt.isCorrect;
          const isStruck = struckIndexes.includes(i);

          return (
            // A alternativa e o botão de riscar são IRMÃOS, não aninhados: um
            // toque em "riscar" dentro do Touchable da opção acabaria
            // respondendo a questão.
            <View
              key={`${card.id}:${i}`}
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

      {/* Feedback + trocar resposta */}
      {answered && (
        <View className="gap-2">
          <Text
            className={`font-inter-semibold text-sm text-center ${
              answeredCorrectly ? 'text-success' : 'text-error'
            }`}
          >
            {answeredCorrectly
              ? '✓ Correto!'
              : '✗ Incorreto — a resposta certa está destacada.'}
          </Text>
          <TouchableOpacity
            onPress={onClearAnswer}
            activeOpacity={0.7}
            className="py-1 items-center"
          >
            <Text className="text-outline font-inter-medium text-sm">
              Trocar resposta
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Navegação livre: voltar/avançar sem responder; sem resposta = tratado
          no Finalizar (modal de questões sem resposta). */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={onPrev}
          disabled={!canPrev}
          activeOpacity={0.7}
          className="flex-1 h-13 rounded-3xl flex-row items-center justify-center gap-1.5 border py-3.5"
          style={{
            borderColor: colors.outlineVariant,
            opacity: canPrev ? 1 : 0.4,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
          <Text className="text-on-surface font-inter-semibold text-sm">
            Anterior
          </Text>
        </TouchableOpacity>

        {isLastPosition ? (
          <View className="flex-1">
            <Button variant="primary" size="md" onPress={onFinish}>
              Finalizar
            </Button>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.7}
            className="flex-1 h-13 rounded-3xl flex-row items-center justify-center gap-1.5 border py-3.5"
            style={{ borderColor: colors.outlineVariant }}
          >
            <Text className="text-on-surface font-inter-semibold text-sm">
              Próxima
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
