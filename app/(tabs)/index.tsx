import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { useStreak } from '@/hooks/useStreak';
import { getDueCards, getNewCards } from '@/services/ai';
import { DeckCard } from '@/components/DeckCard';
import {
  StudyModePicker,
  useStudyModePicker,
} from '@/components/StudyModePicker';
import { StreakBadge } from '@/components/StreakBadge';
import { ProgressRing } from '@/components/ProgressRing';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TAB_SCREEN_BOTTOM_INSET } from '@/constants/layout';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { profile } = useAuth();
  const { decks } = useDecks();
  const { streak, todayCount } = useStreak();
  const picker = useStudyModePicker();

  const DAILY_GOAL = profile?.daily_goal ?? 20;
  const progress = Math.min(todayCount / DAILY_GOAL, 1);
  const goalMet = todayCount >= DAILY_GOAL && todayCount > 0;

  // Deck para a CTA "Estudar agora": o estudado mais recentemente, ou o primeiro.
  const recentDeck = [...decks]
    .filter(d => d.cards.length > 0)
    .sort((a, b) => {
      const at = a.lastStudied ? new Date(a.lastStudied).getTime() : 0;
      const bt = b.lastStudied ? new Date(b.lastStudied).getTime() : 0;
      return bt - at;
    })[0];

  // Só cards de fato vencidos — cards novos não são "revisão pendente".
  const dueOf = (d: (typeof decks)[number]) => getDueCards(d).length;
  const dueCount = decks.reduce((sum, d) => sum + dueOf(d), 0);
  const topDueDeck = [...decks]
    .filter(d => dueOf(d) > 0)
    .sort((a, b) => dueOf(b) - dueOf(a))[0];

  // Cards nunca estudados — "tudo em dia" só quando isto TAMBÉM for zero.
  const newOf = (d: (typeof decks)[number]) => getNewCards(d).length;
  const newCount = decks.reduce((sum, d) => sum + newOf(d), 0);
  const topNewDeck = [...decks]
    .filter(d => newOf(d) > 0)
    .sort((a, b) => newOf(b) - newOf(a))[0];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // Ação principal do dia (herói da tela): revisar > aprender > tudo em dia.
  const cta =
    recentDeck == null
      ? null
      : dueCount > 0
        ? {
            icon: 'refresh' as const,
            tint: colors.primary,
            title: 'Revisar hoje',
            highlight: `${dueCount} ${dueCount === 1 ? 'card' : 'cards'}`,
            tail: 'esperando revisão.',
            label: 'Revisar agora',
            variant: 'primary' as const,
            target: topDueDeck ?? recentDeck,
          }
        : newCount > 0
          ? {
              icon: 'book' as const,
              tint: colors.primary,
              title: 'Pronto pra aprender',
              highlight: `${newCount} ${newCount === 1 ? 'card novo' : 'cards novos'}`,
              tail: 'à sua espera.',
              label: 'Aprender agora',
              variant: 'primary' as const,
              target: topNewDeck ?? recentDeck,
            }
          : {
              icon: 'checkmark-done' as const,
              tint: colors.success,
              title: 'Tudo em dia',
              highlight: null,
              tail: 'Nenhuma revisão pendente por agora.',
              label: `Estudar ${recentDeck.title}`,
              variant: 'outline' as const,
              target: recentDeck,
            };

  return (
    // Sem inset de baixo: a barra de abas já cobre essa área. Com ele, sobrava
    // uma faixa morta acima da barra que cortava o último card.
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: TAB_SCREEN_BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-on-surface-variant font-inter-medium text-sm">
              {greeting}
            </Text>
            <BrandLogo height={26} style={{ marginTop: 2 }} />
          </View>
          <StreakBadge streak={streak} />
        </View>

        {/* Herói: ação do dia */}
        {cta != null && (
          <Card className="mx-5 mt-4 p-5">
            <View className="flex-row items-center gap-3 mb-3">
              <View
                className="w-11 h-11 rounded-button items-center justify-center"
                style={{ backgroundColor: cta.tint + '22' }}
              >
                <Ionicons name={cta.icon} size={22} color={cta.tint} />
              </View>
              <Text className="text-on-surface font-jakarta-bold text-lg flex-1">
                {cta.title}
              </Text>
            </View>
            <Text className="text-on-surface-variant font-inter-regular text-sm leading-5">
              {cta.highlight != null ? (
                <>
                  Você tem{' '}
                  <Text className="text-primary font-inter-semibold">
                    {cta.highlight}
                  </Text>{' '}
                  {cta.tail}
                </>
              ) : (
                cta.tail
              )}
            </Text>
            <Button
              variant={cta.variant}
              size="lg"
              className="mt-4"
              onPress={() => picker.requestPlay(cta.target)}
            >
              {cta.label}
            </Button>
          </Card>
        )}

        {/* Meta diária (secundária) */}
        <Card className="mx-5 mt-4 p-5">
          <View className="flex-row items-center gap-4">
            <View className="flex-1">
              <Text className="text-on-surface font-jakarta-bold text-lg">
                {goalMet ? 'Meta batida!' : 'Meta diária'}
              </Text>
              <Text className="text-on-surface-variant font-inter-regular text-sm mt-1">
                {goalMet
                  ? `${todayCount} cards hoje — mandou bem!`
                  : `${todayCount} de ${DAILY_GOAL} cards estudados`}
              </Text>
              <View className="h-2 bg-surface-container-highest rounded-pill mt-3 overflow-hidden">
                <View
                  className="h-full rounded-pill bg-primary"
                  style={{ width: `${progress * 100}%` }}
                />
              </View>
            </View>
            <ProgressRing
              progress={progress}
              size={72}
              label={goalMet ? '✓' : `${Math.round(progress * 100)}%`}
              sublabel="hoje"
            />
          </View>
        </Card>

        {/* Decks */}
        <View className="mt-7">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-on-surface font-jakarta-bold text-lg">
              {decks.length > 0 ? 'Seus decks' : 'Comece agora'}
            </Text>
            {decks.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/decks')}>
                <Text className="text-primary font-inter-semibold text-sm">
                  Ver todos
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {decks.length === 0 ? (
            <Card className="mx-5 p-8 items-center">
              <View
                className="w-16 h-16 rounded-card items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary + '22' }}
              >
                <Ionicons name="albums" size={28} color={colors.primary} />
              </View>
              <Text className="text-on-surface font-jakarta-bold text-xl text-center">
                Crie seu primeiro deck
              </Text>
              <Text className="text-on-surface-variant font-inter-regular text-sm text-center mt-2 leading-5">
                Organize seus estudos com flashcards personalizados ou gerados
                por IA em segundos
              </Text>
              <Button
                variant="primary"
                size="md"
                className="mt-5 w-full"
                onPress={() => router.push('/deck/create')}
              >
                Criar deck
              </Button>
            </Card>
          ) : (
            <View className="px-5 gap-3">
              {decks.slice(0, 4).map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                  onPlay={() => picker.requestPlay(deck)}
                />
              ))}
              <TouchableOpacity
                activeOpacity={0.7}
                className="border border-dashed border-outline-variant rounded-card py-4 flex-row items-center justify-center gap-1.5"
                onPress={() => router.push('/deck/create')}
              >
                <Ionicons name="add" size={18} color={colors.outline} />
                <Text className="text-outline font-inter-medium text-sm">
                  Novo deck
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <StudyModePicker deck={picker.pickerDeck} onClose={picker.close} />
    </SafeAreaView>
  );
}
