import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { useStreak } from '@/hooks/useStreak';
import { DeckCard } from '@/components/DeckCard';
import { StreakBadge } from '@/components/StreakBadge';
import { ProgressRing } from '@/components/ProgressRing';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const colors = useThemeColors();
  const { decks } = useDecks();
  const { streak, todayCount } = useStreak();

  const DAILY_GOAL = profile?.daily_goal ?? 20;
  const progress = Math.min(todayCount / DAILY_GOAL, 1);

  // Deck para a CTA "Estudar agora": o estudado mais recentemente, ou o primeiro.
  const recentDeck = [...decks]
    .filter(d => d.cards.length > 0)
    .sort((a, b) => {
      const at = a.lastStudied ? new Date(a.lastStudied).getTime() : 0;
      const bt = b.lastStudied ? new Date(b.lastStudied).getTime() : 0;
      return bt - at;
    })[0];

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-outline font-inter-regular text-sm">
              {greeting}
            </Text>
            <Text className="text-on-surface font-jakarta-extrabold text-2xl">
              Recall
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <StreakBadge streak={streak} />
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              className="w-9 h-9 items-center justify-center rounded-xl bg-surface-container"
            >
              <Ionicons name="settings-outline" size={18} color={colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Goal Card */}
        <View className="mx-6 mt-4 bg-surface-container rounded-card p-5 border border-outline-variant/20">
          <View className="flex-row items-center gap-4">
            <View className="flex-1">
              <Text className="text-on-surface font-jakarta-bold text-lg">
                Meta diária
              </Text>
              <Text className="text-outline font-inter-regular text-sm mt-1">
                {todayCount} de {DAILY_GOAL} cards estudados
              </Text>
              <View className="h-2 bg-surface-container-high rounded-full mt-3 overflow-hidden">
                <View
                  className="h-full rounded-full bg-primary-container"
                  style={{ width: `${progress * 100}%` }}
                />
              </View>
            </View>
            <ProgressRing
              progress={progress}
              size={72}
              label={`${Math.round(progress * 100)}%`}
              sublabel="hoje"
            />
          </View>
        </View>

        {/* Study CTA */}
        {recentDeck != null && (
          <View className="mx-6 mt-4">
            <Button
              variant="primary"
              size="lg"
              onPress={() => router.push(`/study/${recentDeck.id}`)}
            >
              Estudar agora • {recentDeck.emoji} {recentDeck.title}
            </Button>
          </View>
        )}

        {/* Decks section */}
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-6 mb-3">
            <Text className="text-on-surface font-jakarta-bold text-lg">
              {decks.length > 0 ? 'Seus decks' : 'Comece agora'}
            </Text>
            {decks.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/decks')}>
                <Text className="text-primary font-inter-medium text-sm">
                  Ver todos
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {decks.length === 0 ? (
            <View className="mx-6 bg-surface-container rounded-card p-8 items-center border border-outline-variant/20">
              <Text className="text-5xl mb-3">🧠</Text>
              <Text className="text-on-surface font-jakarta-bold text-xl text-center">
                Crie seu primeiro deck
              </Text>
              <Text className="text-outline font-inter-regular text-sm text-center mt-2 leading-5">
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
            </View>
          ) : (
            <View className="px-6 gap-3">
              {decks.slice(0, 4).map(deck => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                  onStudy={() => router.push(`/study/${deck.id}`)}
                />
              ))}
              <TouchableOpacity
                className="border border-dashed border-outline-variant rounded-card py-4 items-center"
                onPress={() => router.push('/deck/create')}
              >
                <Text className="text-outline font-inter-medium text-sm">
                  + Novo deck
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
