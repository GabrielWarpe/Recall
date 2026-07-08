import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
const CARD_RADIUS = 16; // deve bater com a classe "rounded-card" do tema

// Quando o card tem imagem, essa fração da altura fica reservada para o
// scrim + texto da pergunta, ancorados embaixo (a faixa em si cresce com o
// texto — isto é só o teto do degradê, não uma altura fixa do texto).
const FRONT_SCRIM_HEIGHT_RATIO = 0.55;

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
  const hasImage = card.images.length > 0;

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
        className="rounded-card overflow-hidden border border-outline-variant/30"
      >
        {hasImage ? (
          <ImageBackground
            source={{ uri: card.images[0] }}
            resizeMode="cover"
            style={{ flex: 1 }}
          >
            <View className="absolute top-4 right-4 bg-black/50 rounded-full px-3 py-1">
              <Text className="text-white font-inter-medium text-xs">
                Questão
              </Text>
            </View>
            {card.images.length > 1 && (
              <View className="absolute top-4 left-4 bg-black/50 rounded-full px-2.5 py-1">
                <Text className="text-white font-inter-medium text-xs">
                  1/{card.images.length}
                </Text>
              </View>
            )}

            {/* Degradê decorativo: cobre até FRONT_SCRIM_HEIGHT_RATIO da
                altura do card, puramente visual (o texto vive na faixa
                sólida abaixo, que cresce com o conteúdo). */}
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: CARD_HEIGHT * FRONT_SCRIM_HEIGHT_RATIO,
              }}
            />

            {/* Faixa de texto: altura automática (cresce com a pergunta),
                ancorada embaixo, sobre fundo sólido para legibilidade. */}
            <View
              className="absolute left-0 right-0 bottom-0 px-6 pt-8 pb-6"
              style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
            >
              <Text
                className="text-white font-jakarta-bold text-xl leading-7 text-center"
                style={{
                  textShadowColor: 'rgba(0,0,0,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                {card.front}
              </Text>
            </View>
          </ImageBackground>
        ) : (
          <View className="flex-1 bg-surface-container items-center justify-center p-8">
            <View className="absolute top-4 right-4 bg-primary/10 rounded-full px-3 py-1">
              <Text className="text-primary font-inter-medium text-xs">
                Questão
              </Text>
            </View>
            <Text className="text-on-surface font-jakarta-bold text-2xl leading-9 text-center">
              {card.front}
            </Text>
          </View>
        )}
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
