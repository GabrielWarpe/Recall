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
  index: number;
  total: number;
  onCorrect: () => void;
  onIncorrect: () => void;
  onSkip: () => void;
}

export function SwipeCard({
  card,
  onCorrect,
  onIncorrect,
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

  const triggerCorrect = () => {
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onCorrect();
  };

  const triggerIncorrect = () => {
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onIncorrect();
  };

  // O arraste só é habilitado após virar o card — e se os gestos estiverem ativos.
  const pan = Gesture.Pan()
    .enabled(isFlipped && settings.swipeGestures)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.25;
    })
    .onEnd(e => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(triggerCorrect)();
          },
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          -width * 1.6,
          { duration: exitDuration },
          () => {
            runOnJS(triggerIncorrect)();
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

  const correctOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const incorrectOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD * 0.5, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Alternativa ao arraste: ao tocar nos botões, o card voa para o lado
  // correspondente com a mesma animação e dispara a resposta.
  const flyOut = (toRight: boolean) => {
    translateX.value = withTiming(
      (toRight ? 1 : -1) * width * 1.6,
      { duration: exitDuration },
      finished => {
        'worklet';
        if (finished) runOnJS(toRight ? triggerCorrect : triggerIncorrect)();
      },
    );
  };

  return (
    <View className="items-center w-full">
      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          {/* Correct overlay */}
          <Animated.View
            style={[
              correctOverlayStyle,
              { position: 'absolute', top: 24, left: 20, zIndex: 10 },
            ]}
            className="bg-green-500/25 border-2 border-green-400 rounded-xl px-4 py-2"
            pointerEvents="none"
          >
            <Text
              className="text-green-400 font-jakarta-bold text-lg"
              style={{ transform: [{ rotate: '-12deg' }] }}
            >
              SABIA! ✓
            </Text>
          </Animated.View>

          {/* Incorrect overlay */}
          <Animated.View
            style={[
              incorrectOverlayStyle,
              { position: 'absolute', top: 24, right: 20, zIndex: 10 },
            ]}
            className="bg-error/25 border-2 border-error rounded-xl px-4 py-2"
            pointerEvents="none"
          >
            <Text
              className="text-error font-jakarta-bold text-lg"
              style={{ transform: [{ rotate: '12deg' }] }}
            >
              ERREI ✗
            </Text>
          </Animated.View>

          <FlashCard
            card={card}
            flipped={isFlipped}
            onPress={() => setIsFlipped(v => !v)}
          />
        </Animated.View>
      </GestureDetector>

      {/* Controles */}
      <View className="mt-6" style={{ width: CARD_WIDTH }}>
        {!isFlipped ? (
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setIsFlipped(true)}
              activeOpacity={0.85}
              className="bg-primary-container rounded-button py-4 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="sync-outline" size={18} color="#ede0ff" />
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
            <View className="flex-row items-center justify-between">
              {/* Errei (esquerda) — toque ou arraste para a esquerda */}
              <TouchableOpacity
                onPress={() => flyOut(false)}
                activeOpacity={0.7}
                className="items-center gap-1.5"
              >
                <View className="w-12 h-12 rounded-full bg-error/20 border border-error/40 items-center justify-center">
                  <Ionicons name="close" size={24} color={colors.error} />
                </View>
                <Text className="text-error font-inter-medium text-xs">
                  Errei
                </Text>
              </TouchableOpacity>

              <Text className="text-outline font-inter-regular text-xs text-center flex-1 mx-2">
                Arraste ou toque{'\n'}para avaliar
              </Text>

              {/* Sabia (direita) — toque ou arraste para a direita */}
              <TouchableOpacity
                onPress={() => flyOut(true)}
                activeOpacity={0.7}
                className="items-center gap-1.5"
              >
                <View className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 items-center justify-center">
                  <Ionicons name="checkmark" size={24} color="#4ade80" />
                </View>
                <Text className="text-green-400 font-inter-medium text-xs">
                  Sabia
                </Text>
              </TouchableOpacity>
            </View>

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
        )}
      </View>
    </View>
  );
}
