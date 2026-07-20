import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { useStreak } from '@/hooks/useStreak';
import { getDueCards, getNewCards } from '@/services/ai';
import { DeckMiniCard, DECK_MINI_CARD_WIDTH } from '@/components/DeckMiniCard';
import {
  StudyModePicker,
  useStudyModePicker,
} from '@/components/StudyModePicker';
import { StreakBadge } from '@/components/StreakBadge';
import { ProgressRing } from '@/components/ProgressRing';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TAB_SCREEN_BOTTOM_INSET } from '@/constants/layout';

const RING_SIZE = 220;

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
  // Goal Gradient: o anel nunca começa vazio de verdade — um piso visual de 6%
  // faz o dia parecer "iniciado" e cria momentum, sem mentir no número (o texto
  // segue "N de M"). Mesmo padrão do levels.tsx.
  const progressFill = Math.max(progress, 0.06);
  const remaining = Math.max(DAILY_GOAL - todayCount, 0);
  // Loss Aversion: perder dói ~2× mais que ganhar. Com uma sequência viva (≥2
  // dias) e a meta ainda não batida, enquadrar pela PERDA da sequência, não
  // pelo ganho genérico da meta. Só ≥2 para não pressionar quem está
  // começando. Independe de já ter estudado algo hoje — o que protege a
  // sequência é BATER a meta, não só ter aberto o app.
  const protectingStreak = streak >= 2 && !goalMet;
  const ringStatus = goalMet
    ? 'Meta batida — sequência garantida!'
    : `faltam ${remaining} ${remaining === 1 ? 'card' : 'cards'} para ${
        protectingStreak ? 'manter a sequência' : 'bater a meta'
      }`;

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

  // Carrossel "Continuar estudando": quem tem mais devido primeiro.
  const carouselDecks = [...decks].sort((a, b) => dueOf(b) - dueOf(a)).slice(0, 8);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const displayName = profile?.name ?? 'Estudante';

  // Ação principal do dia (a ÚNICA CTA da tela): revisar > aprender > tudo em
  // dia. O rótulo já leva a contagem embutida ("Revisar 12 cards") — decide
  // sozinho, sem precisar de um card explicativo ao lado.
  const cta =
    recentDeck == null
      ? null
      : dueCount > 0
        ? {
            label: `Revisar ${dueCount} ${dueCount === 1 ? 'card' : 'cards'}`,
            subtitle: `${(topDueDeck ?? recentDeck).title} · o mais urgente`,
            variant: 'primary' as const,
            target: topDueDeck ?? recentDeck,
          }
        : newCount > 0
          ? {
              label: `Aprender ${newCount} ${newCount === 1 ? 'card novo' : 'cards novos'}`,
              subtitle: `${(topNewDeck ?? recentDeck).title} · pronto para aprender`,
              variant: 'primary' as const,
              target: topNewDeck ?? recentDeck,
            }
          : {
              label: `Estudar ${recentDeck.title}`,
              subtitle: 'Tudo em dia — nenhuma revisão pendente.',
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
            <Text
              className="text-on-surface font-jakarta-extrabold text-2xl"
              style={{ marginTop: 2 }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>
          <StreakBadge streak={streak} />
        </View>

        {/* Anel fundido: meta diária + urgência da sequência num só medidor —
            a Home tem UM trabalho (te colocar na sessão do dia em 1 toque),
            não vários cards competindo por atenção. */}
        <View className="items-center mt-6">
          <View style={{ width: RING_SIZE, height: RING_SIZE }}>
            <ProgressRing progress={progressFill} size={RING_SIZE} strokeWidth={16} />
            <View
              className="items-center justify-center"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Text
                className="text-on-surface font-jakarta-extrabold"
                style={{ fontSize: 52, lineHeight: 56, fontVariant: ['tabular-nums'] }}
              >
                {todayCount}
                <Text
                  className="text-on-surface-variant font-jakarta-bold"
                  style={{ fontSize: 24 }}
                >
                  /{DAILY_GOAL}
                </Text>
              </Text>
              <Text className="text-on-surface-variant font-inter-regular text-sm mt-1">
                cards hoje
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-1.5 mt-4">
            {/* Verde só quando a meta é batida; senão, a chama teal da sequência
                (nada de check verde contradizendo "faltam N cards"). */}
            <Ionicons
              name={goalMet ? 'checkmark-circle' : 'flame'}
              size={16}
              color={goalMet ? colors.success : colors.tertiary}
            />
            <Text className="text-on-surface-variant font-inter-medium text-sm">
              {ringStatus}
            </Text>
          </View>
        </View>

        {/* CTA única do dia — o rótulo já leva a contagem, decide sozinho. */}
        {cta != null && (
          <View className="px-5 mt-6">
            <Button
              variant={cta.variant}
              size="lg"
              onPress={() => picker.requestPlay(cta.target)}
            >
              {cta.label}
            </Button>
            <Text className="text-outline font-inter-regular text-xs text-center mt-2">
              {cta.subtitle}
            </Text>
          </View>
        )}

        {/* Continuar estudando: carrossel secundário — menos rolagem, mais
            decisão. Tocar num card abre o deck; a CTA acima é que "joga". */}
        <View className="mt-8">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-on-surface font-jakarta-bold text-lg">
              {decks.length > 0 ? 'Continuar estudando' : 'Comece agora'}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            >
              {carouselDecks.map(deck => (
                <DeckMiniCard
                  key={deck.id}
                  deck={deck}
                  dueCount={dueOf(deck)}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                />
              ))}
              <TouchableOpacity
                activeOpacity={0.7}
                className="border border-dashed border-outline-variant rounded-card items-center justify-center gap-1.5"
                style={{ width: DECK_MINI_CARD_WIDTH, height: DECK_MINI_CARD_WIDTH }}
                onPress={() => router.push('/deck/create')}
              >
                <Ionicons name="add" size={20} color={colors.outline} />
                <Text className="text-outline font-inter-medium text-xs">
                  Novo deck
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </ScrollView>

      <StudyModePicker deck={picker.pickerDeck} onClose={picker.close} />
    </SafeAreaView>
  );
}
