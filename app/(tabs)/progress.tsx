import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import { format, subDays, isSameDay } from 'date-fns';
import { db } from '@/services/database';
import type { StudySession } from '@/types';
import { StreakBadge } from '@/components/StreakBadge';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { useStreak } from '@/hooks/useStreak';
import { useDecks } from '@/hooks/useDecks';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { levelFromXp } from '@/utils/xp';

const BAR_WIDTH = 28;
const BAR_GAP = 10;
const CHART_HEIGHT = 88;
const DAYS = 7;

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function ProgressScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const { streak } = useStreak();
  const { decks } = useDecks();

  useEffect(() => {
    if (!user) return;
    void db.sessions.getRecent(user.id, 365).then(setSessions);
  }, [user]);

  const last7Days = Array.from({ length: DAYS }, (_, i) =>
    subDays(new Date(), DAYS - 1 - i),
  );

  const cardsByDay = last7Days.map(day => ({
    day,
    total: sessions
      .filter(s => isSameDay(new Date(s.date), day))
      .reduce((sum, s) => sum + s.total, 0),
  }));

  const maxCards = Math.max(...cardsByDay.map(d => d.total), 1);
  const totalCards = sessions.reduce((sum, s) => sum + s.total, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correct, 0);
  const accuracy =
    totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;

  const chartWidth = DAYS * (BAR_WIDTH + BAR_GAP) - BAR_GAP;

  const level = levelFromXp(totalCards);

  // Cards por dia (chave 'yyyy-MM-dd') para o heatmap de atividade.
  const heatmapCounts = sessions.reduce<Record<string, number>>((acc, s) => {
    const key = format(new Date(s.date), 'yyyy-MM-dd');
    acc[key] = (acc[key] ?? 0) + s.total;
    return acc;
  }, {});

  // Domínio por deck: % de cards dominados (3+ acertos), do maior pro menor.
  const mastery = decks
    .filter(d => d.cards.length > 0)
    .map(d => {
      const mastered = d.cards.filter(c => c.mastered).length;
      return {
        id: d.id,
        emoji: d.emoji,
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
        <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
          <Text className="text-on-surface font-jakarta-extrabold text-2xl">
            Progresso
          </Text>
          <StreakBadge streak={streak} size="md" />
        </View>

        {/* Nível / XP */}
        <View className="mx-6 mb-4 bg-surface-container rounded-card p-5 border border-outline-variant/20">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl">⭐</Text>
              <Text className="text-on-surface font-jakarta-bold text-lg">
                Nível {level.level}
              </Text>
            </View>
            <Text className="text-outline font-inter-medium text-xs">
              {level.xpIntoLevel} / {level.xpForLevel} XP
            </Text>
          </View>
          <View className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <View
              className="h-full rounded-full bg-primary-container"
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </View>
        </View>

        {/* Weekly Chart */}
        <View className="mx-6 bg-surface-container rounded-card p-5 border border-outline-variant/20">
          <Text className="text-on-surface font-jakarta-bold text-base mb-5">
            Últimos 7 dias
          </Text>

          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {cardsByDay.map((item, i) => {
              const barH = Math.max(
                (item.total / maxCards) * (CHART_HEIGHT - 8),
                4,
              );
              const x = i * (BAR_WIDTH + BAR_GAP);
              const isToday = isSameDay(item.day, new Date());
              const fill =
                item.total > 0
                  ? isToday
                    ? colors.primaryContainer
                    : colors.primary
                  : colors.surfaceContainerHigh;
              return (
                <Rect
                  key={i}
                  x={x}
                  y={CHART_HEIGHT - barH}
                  width={BAR_WIDTH}
                  height={barH}
                  rx={7}
                  fill={fill}
                />
              );
            })}
          </Svg>

          {/* Day labels */}
          <View
            className="flex-row mt-2"
            style={{ gap: BAR_GAP }}
          >
            {cardsByDay.map((item, i) => (
              <View
                key={i}
                style={{ width: BAR_WIDTH }}
                className="items-center"
              >
                <Text
                  className={`font-inter-regular text-xs ${
                    isSameDay(item.day, new Date())
                      ? 'text-primary'
                      : 'text-outline'
                  }`}
                >
                  {DAY_LABELS[item.day.getDay()]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Heatmap de atividade */}
        <View className="mx-6 mt-4 bg-surface-container rounded-card p-5 border border-outline-variant/20">
          <Text className="text-on-surface font-jakarta-bold text-base mb-4">
            Atividade
          </Text>
          <ActivityHeatmap counts={heatmapCounts} />
        </View>

        {/* Stats grid */}
        <View className="mx-6 mt-4 flex-row flex-wrap gap-3">
          <StatCard
            icon="📖"
            value={String(totalCards)}
            label="Cards estudados"
          />
          <StatCard icon="🎯" value={`${accuracy}%`} label="Taxa de acerto" />
          <StatCard
            icon="⚡"
            value={String(sessions.length)}
            label="Sessões"
          />
          <StatCard icon="🔥" value={`${streak}d`} label="Sequência" />
        </View>

        {/* Domínio por deck */}
        {mastery.length > 0 && (
          <View className="mx-6 mt-4 bg-surface-container rounded-card p-5 border border-outline-variant/20">
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
                    <Text
                      className="text-on-surface font-inter-medium text-sm flex-1 mr-3"
                      numberOfLines={1}
                    >
                      {m.emoji} {m.title}
                    </Text>
                    <Text
                      className="font-jakarta-bold text-sm"
                      style={{ color: masteryColor(m.pct) }}
                    >
                      {m.pct}%
                    </Text>
                  </View>
                  <View className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
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
          </View>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View className="mx-6 mt-5">
            <Text className="text-on-surface font-jakarta-bold text-base mb-3">
              Sessões recentes
            </Text>
            <View className="gap-2">
              {[...sessions]
                .reverse()
                .slice(0, 8)
                .map(session => {
                  const sessionAccuracy =
                    session.total > 0
                      ? Math.round((session.correct / session.total) * 100)
                      : 0;
                  return (
                    <View
                      key={session.id}
                      className="bg-surface-container rounded-card px-4 py-3 flex-row items-center border border-outline-variant/20"
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
                            sessionAccuracy >= 80
                              ? 'text-primary'
                              : sessionAccuracy >= 50
                                ? 'text-tertiary'
                                : 'text-error'
                          }`}
                        >
                          {sessionAccuracy}% acerto
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        {sessions.length === 0 && (
          <View className="items-center mt-8 px-6">
            <Text className="text-4xl mb-3">📊</Text>
            <Text className="text-on-surface font-jakarta-bold text-lg text-center">
              Nenhuma sessão ainda
            </Text>
            <Text className="text-outline font-inter-regular text-sm text-center mt-2">
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
  value,
  label,
}: {
  icon: string;
  value: string;
  label: string;
}) {
  return (
    <View className="bg-surface-container rounded-card p-4 border border-outline-variant/20 flex-1 min-w-[140px]">
      <Text className="text-xl mb-1">{icon}</Text>
      <Text className="text-on-surface font-jakarta-extrabold text-2xl">
        {value}
      </Text>
      <Text className="text-outline font-inter-regular text-xs mt-0.5">
        {label}
      </Text>
    </View>
  );
}
