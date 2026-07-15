import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { FlashCard } from './FlashCard';
import { useSettings } from '@/contexts/SettingsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Flashcard } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const SWIPE_THRESHOLD = width * 0.3;

interface SwipeCardProps {
  card: Flashcard;
  /** Resposta binária: true = acertei, false = errei. */
  onAnswer: (correct: boolean) => void;
  /** Desfaz a resposta anterior e volta ao card anterior. */
  onBack: () => void;
  /** Há resposta anterior para desfazer? */
  canGoBack: boolean;
  /** Contadores da sessão, exibidos dentro dos próprios botões. */
  wrongCount: number;
  rightCount: number;
  onSkip: () => void;
}

export function SwipeCard({
  card,
  onAnswer,
  onBack,
  canGoBack,
  wrongCount,
  rightCount,
  onSkip,
}: SwipeCardProps) {
  const { settings } = useSettings();
  const colors = useThemeColors();
  const [isFlipped, setIsFlipped] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const exitDuration = settings.reduceMotion ? 120 : 280;

  // Resposta automática: vira o card sozinho após um instante, se ativado.
  useEffect(() => {
    if (!settings.autoReveal || isFlipped) return;
    const t = setTimeout(() => setIsFlipped(true), 1200);
    return () => clearTimeout(t);
  }, [settings.autoReveal, isFlipped]);

  // Vibração de resultado (acertou = sucesso, errou = aviso).
  const fireAnswerHaptic = (correct: boolean) => {
    if (!settings.feedbackSounds) return;
    void Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
  };

  // Vibração leve ao revelar a resposta.
  const reveal = () => {
    if (!isFlipped && settings.feedbackSounds) void Haptics.selectionAsync();
    setIsFlipped(true);
  };
  const toggleFlip = () => {
    if (!isFlipped && settings.feedbackSounds) void Haptics.selectionAsync();
    setIsFlipped(v => !v);
  };

  // Anima o card para fora e dispara a resposta: errei sai à esquerda, acertei
  // à direita. A vibração dispara já no toque (não no fim da animação), então o
  // feedback é imediato.
  const flyOut = (correct: boolean) => {
    fireAnswerHaptic(correct);
    translateX.value = withTiming(
      (correct ? 1 : -1) * width * 1.6,
      { duration: exitDuration },
      finished => {
        'worklet';
        if (finished) runOnJS(onAnswer)(correct);
      },
    );
  };

  // O arraste só é habilitado após virar o card — e se os gestos estiverem
  // ativos. Esquerda = errei, direita = acertei (os mesmos dois da barra).
  const pan = Gesture.Pan()
    .enabled(isFlipped && settings.swipeGestures)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.25;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(fireAnswerHaptic)(true);
        translateX.value = withTiming(
          width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(onAnswer)(true);
          },
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(fireAnswerHaptic)(false);
        translateX.value = withTiming(
          -width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(onAnswer)(false);
          },
        );
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width / 2, 0, width / 2],
      [-14, 0, 14],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const goodOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const againOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 0.5, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View className="items-center w-full">
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          {/* Overlay "acertei" (arrastando para a direita) */}
          <Animated.View
            style={[
              goodOverlayStyle,
              { position: 'absolute', top: 24, left: 20, zIndex: 10 },
            ]}
            className="bg-success/25 border-2 border-success rounded-button px-4 py-2"
            pointerEvents="none"
          >
            <Text
              className="text-success font-jakarta-bold text-lg"
              style={{ transform: [{ rotate: '-12deg' }] }}
            >
              ENTENDI ✓
            </Text>
          </Animated.View>

          {/* Overlay "errei" (arrastando para a esquerda) */}
          <Animated.View
            style={[
              againOverlayStyle,
              { position: 'absolute', top: 24, right: 20, zIndex: 10 },
            ]}
            className="bg-error/25 border-2 border-error rounded-button px-4 py-2"
            pointerEvents="none"
          >
            <Text
              className="text-error font-jakarta-bold text-lg"
              style={{ transform: [{ rotate: '12deg' }] }}
            >
              ERREI ✗
            </Text>
          </Animated.View>

          <FlashCard card={card} flipped={isFlipped} onPress={toggleFlip} />
        </Animated.View>
      </GestureDetector>

      {/* Controles */}
      <View className="mt-6" style={{ width: CARD_WIDTH }}>
        {!isFlipped ? (
          <View className="gap-3">
            <TouchableOpacity
              onPress={reveal}
              activeOpacity={0.85}
              className="bg-primary-container rounded-button py-4 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="sync-outline" size={18} color="#dffbf7" />
              <Text className="text-on-primary-container font-inter-semibold text-base">
                Ver resposta
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSkip}
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
          </View>
        ) : (
          <View className="gap-3">
            {/* Estilo NotebookLM: revelou a resposta, responde com dois botões
                claros — "Não sei" e "Sei". O contador de cada um vem discreto ao
                lado, sem virar o protagonista. */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => flyOut(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Errei. ${wrongCount} até agora`}
                className="flex-1 h-14 rounded-3xl flex-row items-center justify-center gap-2 border"
                style={{
                  borderColor: colors.error + '4D',
                  backgroundColor: colors.error + '14',
                }}
              >
                <Ionicons name="close" size={22} color={colors.error} />
                <Text
                  className="font-jakarta-bold text-base"
                  style={{ color: colors.error }}
                >
                  Errei
                </Text>
                {wrongCount > 0 && (
                  <Text
                    className="font-inter-semibold text-sm"
                    style={{ color: colors.error, opacity: 0.7, fontVariant: ['tabular-nums'] }}
                  >
                    {wrongCount}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => flyOut(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Entendi. ${rightCount} até agora`}
                className="flex-1 h-14 rounded-3xl flex-row items-center justify-center gap-2 border"
                style={{
                  borderColor: colors.success + '4D',
                  backgroundColor: colors.success + '14',
                }}
              >
                <Ionicons name="checkmark" size={22} color={colors.success} />
                <Text
                  className="font-jakarta-bold text-base"
                  style={{ color: colors.success }}
                >
                  Entendi
                </Text>
                {rightCount > 0 && (
                  <Text
                    className="font-inter-semibold text-sm"
                    style={{ color: colors.success, opacity: 0.7, fontVariant: ['tabular-nums'] }}
                  >
                    {rightCount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {settings.swipeGestures && (
              <Text className="text-outline font-inter-regular text-xs text-center">
                Arraste ← para "errei" ou → para "entendi"
              </Text>
            )}
          </View>
        )}

        {/* Desfazer: fora do bloco condicional, então fica acessível ANTES de
            virar o próximo card também — senão você teria que virar a carta
            atual só para poder corrigir a resposta anterior. */}
        {canGoBack && (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            className="mt-3 py-1 flex-row items-center justify-center gap-1.5"
          >
            <Ionicons name="arrow-undo-outline" size={15} color={colors.outline} />
            <Text className="text-outline font-inter-medium text-sm">
              Desfazer resposta anterior
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
