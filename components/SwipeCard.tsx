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
import type { Flashcard, Grade } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const SWIPE_THRESHOLD = width * 0.3;

interface SwipeCardProps {
  card: Flashcard;
  index: number;
  total: number;
  onGrade: (grade: Grade) => void;
  onSkip: () => void;
}

const GRADE_BUTTONS: {
  grade: Grade;
  label: string;
  bg: string;
  border: string;
  text: string;
}[] = [
  {
    grade: 'again',
    label: 'De novo',
    bg: 'bg-error/20',
    border: 'border-error/40',
    text: 'text-error',
  },
  {
    grade: 'hard',
    label: 'Difícil',
    bg: 'bg-tertiary/20',
    border: 'border-tertiary/40',
    text: 'text-tertiary',
  },
  {
    grade: 'good',
    label: 'Bom',
    bg: 'bg-primary-container/25',
    border: 'border-primary/40',
    text: 'text-primary',
  },
  {
    grade: 'easy',
    label: 'Fácil',
    bg: 'bg-success/20',
    border: 'border-success/40',
    text: 'text-success',
  },
];

export function SwipeCard({ card, onGrade, onSkip }: SwipeCardProps) {
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

  // Vibração de resultado (verde = sucesso, vermelho/amarelo = aviso).
  const fireGradeHaptic = (g: Grade) => {
    if (!settings.feedbackSounds) return;
    const type =
      g === 'again' || g === 'hard'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;
    void Haptics.notificationAsync(type);
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

  // Anima o card para fora e dispara a avaliação: "De novo" sai à esquerda,
  // os demais à direita. A vibração dispara já no toque (não no fim da
  // animação), então o feedback é imediato.
  const flyOut = (g: Grade) => {
    fireGradeHaptic(g);
    const toRight = g !== 'again';
    translateX.value = withTiming(
      (toRight ? 1 : -1) * width * 1.6,
      { duration: exitDuration },
      finished => {
        'worklet';
        if (finished) runOnJS(onGrade)(g);
      },
    );
  };

  // O arraste só é habilitado após virar o card — e se os gestos estiverem ativos.
  // Esquerda = "De novo", direita = "Bom" (atalhos; os 4 níveis ficam nos botões).
  const pan = Gesture.Pan()
    .enabled(isFlipped && settings.swipeGestures)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.25;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        runOnJS(fireGradeHaptic)('good');
        translateX.value = withTiming(
          width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(onGrade)('good');
          },
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        runOnJS(fireGradeHaptic)('again');
        translateX.value = withTiming(
          -width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(onGrade)('again');
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
          {/* Overlay "Bom" (direita) */}
          <Animated.View
            style={[
              goodOverlayStyle,
              { position: 'absolute', top: 24, left: 20, zIndex: 10 },
            ]}
            className="bg-primary/25 border-2 border-primary rounded-button px-4 py-2"
            pointerEvents="none"
          >
            <Text
              className="text-primary font-jakarta-bold text-lg"
              style={{ transform: [{ rotate: '-12deg' }] }}
            >
              BOM ✓
            </Text>
          </Animated.View>

          {/* Overlay "De novo" (esquerda) */}
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
              DE NOVO ↺
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
          <View className="gap-4">
            {/* 4 níveis de avaliação */}
            <View className="flex-row gap-2">
              {GRADE_BUTTONS.map(b => (
                <TouchableOpacity
                  key={b.grade}
                  onPress={() => flyOut(b.grade)}
                  activeOpacity={0.75}
                  className={`flex-1 rounded-button py-3 items-center border ${b.bg} ${b.border}`}
                >
                  <Text className={`font-inter-semibold text-sm ${b.text}`}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {settings.swipeGestures && (
              <Text className="text-outline font-inter-regular text-xs text-center">
                Arraste ← para "De novo" ou → para "Bom"
              </Text>
            )}

            <TouchableOpacity
              onPress={onSkip}
              activeOpacity={0.7}
              className="py-1 flex-row items-center justify-center gap-1.5"
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
        )}
      </View>
    </View>
  );
}
