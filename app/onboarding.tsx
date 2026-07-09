import React, { useState } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
  Easing,
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
  accent: keyof Pick<ThemePalette, 'primary' | 'tertiary' | 'info' | 'success'>;
  title: string;
  body: string;
  /** Mini-demonstração visual da feature, exibida dentro do card. */
  demo: (colors: ThemePalette) => React.ReactNode;
}

// ── Mini-demos: cada slide mostra a feature "em miniatura" ───────────────────

/** Slide 1: um deck como aparece na lista (emoji + título + tags). */
function DeckDemo(colors: ThemePalette) {
  return (
    <View className="w-full bg-surface-container-high rounded-2xl p-4 flex-row items-center gap-3">
      <View
        className="w-12 h-12 rounded-xl items-center justify-center"
        style={{ backgroundColor: colors.primary + '1f' }}
      >
        <Text className="text-2xl">🧬</Text>
      </View>
      <View className="flex-1">
        <Text className="text-on-surface font-jakarta-bold text-sm">
          Biologia — Célula
        </Text>
        <Text className="text-outline font-inter-regular text-xs mt-0.5">
          24 cards · gerado com IA
        </Text>
      </View>
      <Ionicons name="sparkles" size={18} color={colors.primary} />
    </View>
  );
}

/** Slide 2: os quatro botões de avaliação do modo estudo. */
function GradesDemo(colors: ThemePalette) {
  const grades: { label: string; tint: string }[] = [
    { label: 'De novo', tint: colors.error },
    { label: 'Difícil', tint: colors.tertiary },
    { label: 'Bom', tint: colors.primary },
    { label: 'Fácil', tint: colors.success },
  ];
  return (
    <View className="w-full flex-row justify-center gap-2">
      {grades.map(g => (
        <View
          key={g.label}
          className="rounded-pill px-3 py-2"
          style={{ backgroundColor: g.tint + '22' }}
        >
          <Text className="font-inter-semibold text-xs" style={{ color: g.tint }}>
            {g.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Slide 3: alternativas de quiz, com a correta marcada. */
function QuizDemo(colors: ThemePalette) {
  return (
    <View className="w-full gap-2">
      <View className="bg-surface-container-high rounded-xl px-4 py-3 flex-row items-center border border-outline-variant/30">
        <Text className="flex-1 text-on-surface-variant font-inter-regular text-sm">
          Mitocôndria
        </Text>
      </View>
      <View
        className="rounded-xl px-4 py-3 flex-row items-center border"
        style={{
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        }}
      >
        <Text className="flex-1 text-on-surface font-inter-semibold text-sm">
          Ribossomo
        </Text>
        <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
      </View>
    </View>
  );
}

/** Slide 4: sequência + meta diária em progresso. */
function StreakDemo(colors: ThemePalette) {
  return (
    <View className="w-full bg-surface-container-high rounded-2xl p-4 gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="flame" size={20} color={colors.tertiary} />
        <Text className="text-on-surface font-jakarta-bold text-sm">
          7 dias seguidos
        </Text>
        <View className="flex-1" />
        <Ionicons name="trophy" size={18} color={colors.tertiary} />
        <Text className="text-outline font-inter-medium text-xs">12/20</Text>
      </View>
      <View className="h-2 bg-surface-container-highest rounded-pill overflow-hidden">
        <View
          className="h-full rounded-pill"
          style={{ width: '70%', backgroundColor: colors.primary }}
        />
      </View>
      <Text className="text-outline font-inter-regular text-xs">
        Meta diária: 14 de 20 cards
      </Text>
    </View>
  );
}

// Tour das features reais do app, na ordem em que o usuário as encontra.
const SLIDES: Slide[] = [
  {
    icon: 'sparkles',
    accent: 'primary',
    title: 'Crie decks em segundos',
    body: 'Monte seus decks manualmente, anexe imagens aos cards ou deixe a IA gerar tudo a partir de um tópico ou texto.',
    demo: DeckDemo,
  },
  {
    icon: 'layers',
    accent: 'primary',
    title: 'Estude no ritmo certo',
    body: 'A repetição espaçada agenda cada card para a hora exata de revisar. Avalie cada resposta — ou simplesmente deslize o card.',
    demo: GradesDemo,
  },
  {
    icon: 'extension-puzzle',
    accent: 'info',
    title: 'Pratique de outros jeitos',
    body: 'Além dos flashcards, teste-se com o Quiz de alternativas ou digite a resposta no modo Escrever.',
    demo: QuizDemo,
  },
  {
    icon: 'flame',
    accent: 'tertiary',
    title: 'Crie o hábito',
    body: 'Defina sua meta diária, mantenha a sequência viva e desbloqueie conquistas enquanto acompanha seu progresso.',
    demo: StreakDemo,
  },
];

/** Uma face do card do tutorial (mesma superfície/sombra dos cards do app). */
function SlideFace({ slide }: { slide: Slide }) {
  const colors = useThemeColors();
  const tint = colors[slide.accent];
  return (
    <View className="flex-1 items-center justify-center px-7 py-8">
      <View
        className="w-16 h-16 rounded-card items-center justify-center mb-5"
        style={{ backgroundColor: tint + '1f' }}
      >
        <Ionicons name={slide.icon} size={30} color={tint} />
      </View>
      <Text
        className="text-on-surface font-jakarta-extrabold text-2xl text-center"
        style={{ letterSpacing: -0.5 }}
      >
        {slide.title}
      </Text>
      <Text className="text-on-surface-variant font-inter-regular text-sm text-center mt-3 leading-5">
        {slide.body}
      </Text>
      <View className="mt-6 w-full items-center">{slide.demo(colors)}</View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { complete } = useOnboarding();
  const { settings } = useSettings();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  const CARD_WIDTH = width - 48;
  const CARD_HEIGHT = CARD_WIDTH * 1.35;

  // `index` = slide visível na frente; durante a virada, `pending` é o slide
  // que está impresso no verso e assume ao fim da animação.
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const progress = useSharedValue(0);

  const shown = pending ?? index;
  const isLast = shown === SLIDES.length - 1;

  const finish = () => {
    complete();
    router.replace('/(tabs)');
  };

  // Mesma virada 3D do FlashCard do modo estudo.
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

  // Ao terminar a virada, o verso vira a nova frente e o card "desarma".
  const commitFlip = (target: number) => {
    setIndex(target);
    setPending(null);
    progress.value = 0;
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    if (pending !== null) return; // ignora toques durante a virada
    const target = index + 1;
    if (settings.reduceMotion) {
      setIndex(target);
      return;
    }
    setPending(target);
    progress.value = withTiming(
      1,
      { duration: 550, easing: Easing.out(Easing.cubic) },
      finished => {
        if (finished) runOnJS(commitFlip)(target);
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* Pular — sempre presente (invisível no último) para o layout não pular */}
      <View className="flex-row justify-end px-5 pt-3">
        <TouchableOpacity
          onPress={finish}
          activeOpacity={0.7}
          disabled={isLast}
          hitSlop={12}
          className="px-3 py-2"
          style={{ opacity: isLast ? 0 : 1 }}
        >
          <Text className="text-outline font-inter-medium text-sm">Pular</Text>
        </TouchableOpacity>
      </View>

      {/* Card com virada 3D entre os passos */}
      <View className="flex-1 items-center justify-center">
        <View style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {/* Frente: passo atual */}
          <Animated.View
            style={[
              frontStyle,
              cardShadow,
              { position: 'absolute', width: '100%', height: '100%' },
            ]}
            className="bg-surface-container rounded-card border border-outline-variant/20"
          >
            <SlideFace slide={SLIDES[index]} />
          </Animated.View>

          {/* Verso: próximo passo (pré-girado 180°, aparece durante a virada) */}
          <Animated.View
            style={[
              backStyle,
              cardShadow,
              { position: 'absolute', width: '100%', height: '100%' },
            ]}
            className="bg-surface-container rounded-card border border-outline-variant/20"
          >
            <SlideFace slide={SLIDES[pending ?? Math.min(index + 1, SLIDES.length - 1)]} />
          </Animated.View>
        </View>
      </View>

      {/* Dots */}
      <View className="flex-row justify-center gap-2 mb-6">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            className="h-2 rounded-pill"
            style={{
              width: i === shown ? 22 : 8,
              backgroundColor:
                i === shown ? colors.primary : colors.surfaceContainerHighest,
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
