import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

interface Slide {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: 'primary' | 'tertiary';
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'school',
    accent: 'primary',
    title: 'Aprenda de verdade',
    body: 'Flashcards com repetição espaçada ajudam você a fixar o que importa — sem decoreba de última hora.',
  },
  {
    icon: 'flash',
    accent: 'primary',
    title: 'Crie em segundos',
    body: 'Monte seus decks manualmente ou deixe a IA gerar os cards a partir de qualquer tópico ou texto.',
  },
  {
    icon: 'flame',
    accent: 'tertiary',
    title: 'Crie o hábito',
    body: 'Estude um pouco todo dia, acompanhe seu progresso e mantenha sua sequência viva.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { complete } = useOnboarding();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    complete();
    router.replace('/(tabs)');
  };

  // Atualiza o índice ao arrastar manualmente (mantém os dots em sincronia).
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
    scrollRef.current?.scrollTo({ x: width * target, animated: true });
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

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {SLIDES.map((s, i) => {
          const tint = s.accent === 'tertiary' ? colors.tertiary : colors.primary;
          return (
            <View
              key={i}
              style={{ width }}
              className="flex-1 items-center justify-center px-10"
            >
              <View
                className="w-28 h-28 rounded-card items-center justify-center mb-8"
                style={{ backgroundColor: tint + '1f' }}
              >
                <Ionicons name={s.icon} size={52} color={tint} />
              </View>
              <Text
                className="text-on-surface font-jakarta-extrabold text-3xl text-center"
                style={{ letterSpacing: -0.5 }}
              >
                {s.title}
              </Text>
              <Text className="text-on-surface-variant font-inter-regular text-base text-center mt-4 leading-6">
                {s.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>

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
