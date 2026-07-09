import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { db } from '@/services/database';
import type { StudySession } from '@/types';
import { cardMaturity, type Maturity } from '@/services/ai';
import { StreakBadge } from '@/components/StreakBadge';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { DeckAvatar } from '@/components/DeckAvatar';
import { Card, cardShadow } from '@/components/ui/Card';
import { useStreak } from '@/hooks/useStreak';
import { useDecks } from '@/hooks/useDecks';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { levelFromXp, tierForLevel, nextTier } from '@/utils/xp';
import { sessionAccuracy, formatDuration } from '@/utils/stats';

const DAYS = 7;

export default function ProgressScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [leeches, setLeeches] = useState<{ cardId: string; againCount: number }[]>([]);
  const { streak } = useStreak();
  const { decks } = useDecks();

  // Recarrega sempre que a tela ganha foco (ex.: ao voltar de criar um deck
  // ou de uma sessão de estudo), senão os dados ficam presos do primeiro
  // carregamento — decks já faz isso via useDecks, mas sessões/leeches
  // viviam num useEffect preso ao usuário, não à tela.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void db.sessions.getRecent(user.id, 365).then(setSessions);
      void db.reviews.getLeeches(user.id).then(setLeeches);
    }, [user]),
  );

  // "O que estudar agora" (vencidos/novos) vive na Home, com CTA e copy
  // encorajadora. O Progresso foca no que já foi feito — evita mostrar
  // "0 / 0" logo após estudar, que lia como se estivesse quebrado.
  const allCards = decks.flatMap(d => d.cards);

  const totalCards = sessions.reduce((sum, s) => sum + s.total, 0);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const accuracy = sessionAccuracy({
    correct: sessions.reduce((sum, s) => sum + s.correct, 0),
    hard: sessions.reduce((sum, s) => sum + s.hard, 0),
    again: sessions.reduce((sum, s) => sum + s.again, 0),
  });

  const level = levelFromXp(totalCards);
  const tier = tierForLevel(level.level);
  const upcomingTier = nextTier(level.level);
  const xpToNextLevel = level.xpForLevel - level.xpIntoLevel;
  // A próxima patente entra em jogo já no próximo nível? Vira a chamada.
  const nextLevelUnlocksTier =
    upcomingTier != null && upcomingTier.minLevel === level.level + 1;

  // Cards por dia (chave 'yyyy-MM-dd') para o heatmap de atividade.
  const heatmapCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const key = format(new Date(s.date), 'yyyy-MM-dd');
    acc[key] = (acc[key] ?? 0) + s.total;
    return acc;
  }, {});
  const last7Total = Array.from({ length: DAYS }, (_, i) => {
    const key = format(subDays(new Date(), i), 'yyyy-MM-dd');
    return heatmapCounts[key] ?? 0;
  }).reduce((sum, n) => sum + n, 0);

  // Maturidade: distribuição dos cards entre novo/aprendendo/jovem/maduro.
  const MATURITY_ORDER: Maturity[] = ['new', 'learning', 'young', 'mature'];
  const MATURITY_LABELS: Record<Maturity, string> = {
    new: 'Novo',
    learning: 'Aprendendo',
    young: 'Jovem',
    mature: 'Maduro',
  };
  const maturityCounts = allCards.reduce(
    (acc, c) => {
      acc[cardMaturity(c)] += 1;
      return acc;
    },
    { new: 0, learning: 0, young: 0, mature: 0 } as Record<Maturity, number>,
  );
  // Progressão de um único matiz (cor de destaque em opacidade crescente) —
  // lê como "ficando mais sólido", em vez de 4 cores sem relação entre si.
  const maturityColors: Record<Maturity, string> = {
    new: colors.surfaceContainerHighest,
    learning: colors.primary + '4D',
    young: colors.primary + '99',
    mature: colors.primary,
  };

  // Leeches: cards que mais vêm com "De novo", enriquecidos com o texto do
  // card e o deck (para dar contexto e permitir tocar e ir até ele).
  const cardLookup = new Map<
    string,
    { front: string; deckId: string; deckTitle: string; deckEmoji: string }
  >();
  for (const d of decks) {
    for (const c of d.cards) {
      cardLookup.set(c.id, {
        front: c.front,
        deckId: d.id,
        deckTitle: d.title,
        deckEmoji: d.emoji,
      });
    }
  }
  const leechDetails = leeches
    .map(l => ({ ...l, card: cardLookup.get(l.cardId) }))
    .filter((l): l is typeof l & { card: NonNullable<typeof l.card> } => l.card != null)
    .slice(0, 5);

  // Domínio por deck: % de cards dominados (3+ acertos), do maior pro menor.
  const mastery = decks
    .filter(d => d.cards.length > 0)
    .map(d => {
      const mastered = d.cards.filter(c => c.mastered).length;
      return {
        id: d.id,
        coverUrl: d.coverUrl,
        title: d.title,
        mastered,
        total: d.cards.length,
        pct: Math.round((mastered / d.cards.length) * 100),
      };
    })
    .sort((a, b) => b.pct - a.pct || a.title.localeCompare(b.title, 'pt'));

  const masteryColor = (pct: number): string =>
    pct >= 75 ? colors.primary : pct >= 40 ? colors.tertiary : colors.outline;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-4 flex-row items-center justify-between">
          <Text
            className="text-on-surface font-jakarta-extrabold text-3xl"
            style={{ letterSpacing: -0.5 }}
          >
            Progresso
          </Text>
          <StreakBadge streak={streak} size="md" />
        </View>

        {/* Patente / Nível / XP — toca para ver todos os níveis */}
        <TouchableOpacity
          activeOpacity={0.85}
          // Cast: a rota /levels só entra nos tipos gerados no próximo
          // `expo start` (typed routes).
          onPress={() => router.push('/levels' as Href)}
        >
        <Card className="mx-5 mb-4 p-5">
          <View className="flex-row items-center">
            {/* Emblema da patente */}
            <View
              className="w-16 h-16 rounded-card items-center justify-center"
              style={{ backgroundColor: tier.color + '26' }}
            >
              <Text style={{ fontSize: 30 }}>{tier.emoji}</Text>
            </View>

            <View className="flex-1 ml-4">
              <Text
                className="font-jakarta-extrabold text-xl"
                style={{ color: tier.color }}
              >
                {tier.name}
              </Text>
              <Text className="text-on-surface-variant font-inter-medium text-sm mt-0.5">
                Nível {level.level}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-on-surface font-jakarta-extrabold text-lg">
                {level.xp.toLocaleString('pt-BR')}
              </Text>
              <Text className="text-outline font-inter-regular text-xs">
                XP total
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.outline}
              style={{ marginLeft: 8 }}
            />
          </View>

          {/* Barra de progresso do nível atual */}
          <View className="h-2.5 bg-surface-container-high rounded-pill overflow-hidden mt-4">
            <View
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(Math.round(level.progress * 100), 3)}%`,
                backgroundColor: tier.color,
              }}
            />
          </View>

          {/* Meta do próximo nível + prévia da próxima patente */}
          <View className="flex-row items-center justify-between mt-2.5">
            <Text className="text-on-surface-variant font-inter-medium text-xs">
              +{xpToNextLevel} XP para o Nível {level.level + 1}
            </Text>
            {upcomingTier != null && (
              <Text className="text-outline font-inter-regular text-xs">
                {nextLevelUnlocksTier ? 'Desbloqueia' : 'Próxima'}: {upcomingTier.emoji}{' '}
                {upcomingTier.name}
              </Text>
            )}
          </View>
        </Card>
        </TouchableOpacity>

        {/* Heatmap de atividade */}
        <Card className="mx-5 mt-4 p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-on-surface font-jakarta-bold text-base">
              Atividade
            </Text>
            <Text className="text-outline font-inter-regular text-xs">
              {last7Total} nos últimos 7 dias
            </Text>
          </View>
          <ActivityHeatmap counts={heatmapCounts} />
        </Card>

        {/* Stats grid */}
        <View className="mx-5 mt-4 flex-row flex-wrap gap-3">
          <StatCard
            icon="book"
            tint={colors.primary}
            value={String(totalCards)}
            label="Cards estudados"
          />
          <StatCard
            icon="checkmark-done"
            tint={colors.success}
            value={`${accuracy}%`}
            label="Taxa de acerto"
          />
          <StatCard
            icon="albums"
            tint={colors.info}
            value={String(sessions.length)}
            label="Sessões"
          />
          <StatCard
            icon="flame"
            tint={colors.tertiary}
            value={`${streak}d`}
            label="Sequência"
          />
          <StatCard
            icon="time"
            tint={colors.primary}
            value={formatDuration(totalSeconds)}
            label="Tempo estudado"
          />
        </View>

        {/* Maturidade dos cards */}
        {allCards.length > 0 && (
          <Card className="mx-5 mt-4 p-5">
            <Text className="text-on-surface font-jakarta-bold text-base mb-1">
              Maturidade dos cards
            </Text>
            <Text className="text-outline font-inter-regular text-xs mb-4">
              Do card novo ao dominado
            </Text>
            <View className="h-3 rounded-pill overflow-hidden flex-row bg-surface-container-high">
              {MATURITY_ORDER.map(k =>
                maturityCounts[k] > 0 ? (
                  <View
                    key={k}
                    style={{
                      width: `${(maturityCounts[k] / allCards.length) * 100}%`,
                      backgroundColor: maturityColors[k],
                    }}
                  />
                ) : null,
              )}
            </View>
            <View className="flex-row mt-4">
              {MATURITY_ORDER.map(k => (
                <View key={k} className="flex-1 items-center">
                  <View
                    className="w-2.5 h-2.5 rounded-full mb-1.5"
                    style={{ backgroundColor: maturityColors[k] }}
                  />
                  <Text className="text-on-surface font-jakarta-bold text-sm">
                    {maturityCounts[k]}
                  </Text>
                  <Text className="text-outline font-inter-regular text-xs mt-0.5">
                    {MATURITY_LABELS[k]}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Cards que travam (leeches) */}
        {leechDetails.length > 0 && (
          <Card className="mx-5 mt-4 p-5">
            <Text className="text-on-surface font-jakarta-bold text-base mb-1">
              Cards que travam
            </Text>
            <Text className="text-outline font-inter-regular text-xs mb-4">
              Marcados "De novo" 4+ vezes — talvez valha reformular
            </Text>
            <View className="gap-2">
              {leechDetails.map(l => (
                <TouchableOpacity
                  key={l.cardId}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/deck/${l.card.deckId}`)}
                  className="flex-row items-center justify-between bg-surface-container-high rounded-button px-3 py-2.5"
                >
                  <View className="flex-1 mr-3">
                    <Text
                      className="text-on-surface font-inter-medium text-sm"
                      numberOfLines={1}
                    >
                      {l.card.front}
                    </Text>
                    <Text className="text-outline font-inter-regular text-xs mt-0.5">
                      {l.card.deckEmoji} {l.card.deckTitle}
                    </Text>
                  </View>
                  <View className="bg-error/15 rounded-pill px-2.5 py-1">
                    <Text className="text-error font-jakarta-bold text-xs">
                      {l.againCount}×
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Domínio por deck */}
        {mastery.length > 0 && (
          <Card className="mx-5 mt-4 p-5">
            <Text className="text-on-surface font-jakarta-bold text-base mb-1">
              Domínio por deck
            </Text>
            <Text className="text-outline font-inter-regular text-xs mb-4">
              Cards dominados = 3+ revisões corretas seguidas
            </Text>
            <View className="gap-4">
              {mastery.map(m => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/deck/${m.id}`)}
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-2 flex-1 mr-3">
                      <DeckAvatar coverUrl={m.coverUrl} size={22} radius={7} />
                      <Text
                        className="text-on-surface font-inter-medium text-sm flex-1"
                        numberOfLines={1}
                      >
                        {m.title}
                      </Text>
                    </View>
                    <Text
                      className="font-jakarta-bold text-sm"
                      style={{ color: masteryColor(m.pct) }}
                    >
                      {m.pct}%
                    </Text>
                  </View>
                  <View className="h-2 bg-surface-container-high rounded-pill overflow-hidden">
                    <View
                      className="h-full rounded-pill"
                      style={{
                        width: `${m.pct}%`,
                        backgroundColor: masteryColor(m.pct),
                      }}
                    />
                  </View>
                  <Text className="text-outline font-inter-regular text-xs mt-1">
                    {m.mastered} de {m.total} cards dominados
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View className="mx-5 mt-6">
            <Text className="text-on-surface font-jakarta-bold text-base mb-3">
              Sessões recentes
            </Text>
            <View className="gap-2">
              {/* getRecent já vem da mais nova para a mais antiga. */}
              {sessions
                .slice(0, 8)
                .map(session => {
                  const pct = sessionAccuracy(session);
                  return (
                    <View
                      key={session.id}
                      className="bg-surface-container rounded-card px-4 py-3 flex-row items-center"
                      style={cardShadow}
                    >
                      <View className="flex-1">
                        <Text className="text-on-surface font-inter-medium text-sm">
                          {session.deckTitle}
                        </Text>
                        <Text className="text-outline font-inter-regular text-xs mt-0.5">
                          {format(
                            new Date(session.date),
                            "d MMM 'às' HH:mm",
                          )}
                        </Text>
                      </View>
                      <View className="items-end gap-0.5">
                        <Text className="text-on-surface font-jakarta-semibold text-sm">
                          {session.total} cards
                        </Text>
                        <Text
                          className={`font-inter-medium text-xs ${
                            pct >= 80
                              ? 'text-primary'
                              : pct >= 50
                                ? 'text-tertiary'
                                : 'text-error'
                          }`}
                        >
                          {pct}% acerto
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        {sessions.length === 0 && (
          <View className="items-center mt-10 px-6">
            <View
              className="w-16 h-16 rounded-card items-center justify-center mb-4"
              style={{ backgroundColor: colors.primary + '22' }}
            >
              <Ionicons name="bar-chart" size={26} color={colors.primary} />
            </View>
            <Text className="text-on-surface font-jakarta-bold text-lg text-center">
              Nenhuma sessão ainda
            </Text>
            <Text className="text-on-surface-variant font-inter-regular text-sm text-center mt-2">
              Complete uma sessão de estudo para ver seu progresso
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  tint,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  value: string;
  label: string;
}) {
  return (
    <View
      className="bg-surface-container rounded-card p-4 flex-1 min-w-[140px]"
      style={cardShadow}
    >
      <View
        className="w-8 h-8 rounded-button items-center justify-center mb-2"
        style={{ backgroundColor: tint + '22' }}
      >
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text className="text-on-surface font-jakarta-extrabold text-2xl">
        {value}
      </Text>
      <Text className="text-on-surface-variant font-inter-regular text-xs mt-0.5">
        {label}
      </Text>
    </View>
  );
}
