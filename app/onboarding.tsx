import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { ThemePalette } from '@/constants/theme';

interface Slide {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Cor de destaque do slide (chave da paleta do tema). */
  accent: keyof Pick<ThemePalette, 'primary' | 'tertiary' | 'info'>;
  title: string;
  body: string;
}

// Tour das features reais do app, na ordem em que o usuário as encontra.
const SLIDES: Slide[] = [
  {
    icon: 'sparkles',
    accent: 'primary',
    title: 'Crie decks em segundos',
    body: 'Monte seus decks manualmente, anexe imagens aos cards ou deixe a IA gerar tudo a partir de um tópico ou texto.',
  },
  {
    icon: 'layers',
    accent: 'primary',
    title: 'Estude no ritmo certo',
    body: 'A repetição espaçada agenda cada card para a hora exata de revisar. Avalie com De novo, Difícil, Bom ou Fácil — ou simplesmente deslize o card.',
  },
  {
    icon: 'extension-puzzle',
    accent: 'info',
    title: 'Pratique de outros jeitos',
    body: 'Além dos flashcards, teste-se com o Quiz de alternativas ou digite a resposta no modo Escrever.',
  },
  {
    icon: 'flame',
    accent: 'tertiary',
    title: 'Crie o hábito',
    body: 'Defina sua meta diária, mantenha a sequência viva e desbloqueie conquistas enquanto acompanha seu progresso.',
  },
];

/**
 * Slide do tutorial no formato de card padrão do app (mesma superfície e
 * sombra de ui/Card). Escala/opacidade seguem o dedo durante o arrasto.
 */
function SlideCard({
  slide,
  index,
  scrollX,
  width,
  reduceMotion,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  reduceMotion: boolean;
}) {
  const colors = useThemeColors();
  const tint = colors[slide.accent];
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return {
      opacity: interpolate(
        scrollX.value,
        range,
        [0.35, 1, 0.35],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            range,
            [0.92, 1, 0.92],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <View style={{ width }} className="flex-1 items-center justify-center px-6">
      <Animated.View
        style={[cardShadow, animatedStyle]}
        className="w-full bg-surface-container rounded-card px-8 py-10 items-center"
      >
        <View
          className="w-24 h-24 rounded-card items-center justify-center mb-7"
          style={{ backgroundColor: tint + '1f' }}
        >
          <Ionicons name={slide.icon} size={46} color={tint} />
        </View>
        <Text
          className="text-on-surface font-jakarta-extrabold text-2xl text-center"
          style={{ letterSpacing: -0.5 }}
        >
          {slide.title}
        </Text>
        <Text className="text-on-surface-variant font-inter-regular text-base text-center mt-4 leading-6">
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { complete } = useOnboarding();
  const { settings } = useSettings();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    complete();
    router.replace('/(tabs)');
  };

  const onScrollWorklet = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });

  // Atualiza o índice ao arrastar manualmente (mantém os dots em sincronia).
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  // Avança pelo botão: atualiza o estado NA HORA (não depende do callback de
  // scroll, que não dispara de forma confiável em rolagem programática) e
  // então rola até o próximo slide.
  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    const target = index + 1;
    setIndex(target);
    scrollRef.current?.scrollTo({
      x: width * target,
      animated: !settings.reduceMotion,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Pular */}
      <View className="flex-row justify-end px-5 pt-2 h-10">
        {!isLast && (
          <TouchableOpacity onPress={finish} activeOpacity={0.7} className="p-2">
            <Text className="text-outline font-inter-medium text-sm">Pular</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides em cards */}
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScrollWorklet}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {SLIDES.map((s, i) => (
          <SlideCard
            key={i}
            slide={s}
            index={i}
            scrollX={scrollX}
            width={width}
            reduceMotion={settings.reduceMotion}
          />
        ))}
      </Animated.ScrollView>

      {/* Dots */}
      <View className="flex-row justify-center gap-2 mb-6">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            className="h-2 rounded-pill"
            style={{
              width: i === index ? 22 : 8,
              backgroundColor:
                i === index ? colors.primary : colors.surfaceContainerHighest,
            }}
          />
        ))}
      </View>

      {/* CTA */}
      <View className="px-6 pb-4 pt-2">
        <Button variant="primary" size="lg" className="w-full" onPress={next}>
          {isLast ? 'Começar' : 'Próximo'}
        </Button>
      </View>
    </SafeAreaView>
  );
}
