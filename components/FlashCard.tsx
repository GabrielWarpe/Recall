import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import type { Flashcard } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const CARD_HEIGHT = CARD_WIDTH * 1.25;

interface FlashCardProps {
  card: Flashcard;
  /** Controlado externamente: false = pergunta, true = resposta. */
  flipped: boolean;
  /** Toque no card também alterna (opcional). */
  onPress?: () => void;
}

export function FlashCard({ card, flipped, onPress }: FlashCardProps) {
  const { settings } = useSettings();
  const progress = useSharedValue(0);

  // Anima a virada sempre que o estado controlado muda.
  useEffect(() => {
    progress.value = withTiming(flipped ? 1 : 0, {
      duration: settings.reduceMotion ? 0 : 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [flipped, progress, settings.reduceMotion]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(progress.value, [0, 1], [180, 360])}deg` },
    ],
    backfaceVisibility: 'hidden',
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.97 : 1}
      disabled={!onPress}
      style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
    >
      {/* Front face */}
      <Animated.View
        style={[
          frontStyle,
          { position: 'absolute', width: '100%', height: '100%' },
        ]}
        className="bg-surface-container rounded-card border border-outline-variant/30 items-center justify-center p-8"
      >
        <View className="absolute top-4 right-4 bg-primary/10 rounded-full px-3 py-1">
          <Text className="text-primary font-inter-medium text-xs">Questão</Text>
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center leading-9">
          {card.front}
        </Text>
      </Animated.View>

      {/* Back face */}
      <Animated.View
        style={[
          backStyle,
          { position: 'absolute', width: '100%', height: '100%' },
        ]}
        className="bg-surface-container-high rounded-card border border-primary/30 items-center justify-center p-8"
      >
        <View className="absolute top-4 right-4 bg-primary/20 rounded-full px-3 py-1">
          <Text className="text-primary font-inter-medium text-xs">Resposta</Text>
        </View>
        <Text className="text-on-surface font-jakarta-semibold text-xl text-center leading-8">
          {card.back}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}
