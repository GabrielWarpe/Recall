import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';
import {
  levelFromXp,
  tierForLevel,
  xpForLevelStart,
  LEVEL_TIERS,
} from '@/utils/xp';
import { Card } from '@/components/ui/Card';
import { TierBadge } from '@/components/TierBadge';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Todos os níveis/patentes e quanto XP falta para cada um. Cada card revisado
 * vale 1 XP; o custo por nível cresce aos poucos (ver utils/xp.ts).
 */
export default function LevelsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [xp, setXp] = useState(0);

  // Mesma fonte de XP do Progresso: total de cards revisados nas sessões.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void db.sessions.getRecent(user.id, 365).then(sessions => {
        setXp(sessions.reduce((sum, s) => sum + s.total, 0));
      });
    }, [user]),
  );

  const level = levelFromXp(xp);
  const tier = tierForLevel(level.level);
  const xpToNextLevel = level.xpForLevel - level.xpIntoLevel;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3 border-b border-outline-variant/15">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text className="flex-1 text-on-surface font-jakarta-bold text-lg ml-1">
          Níveis e patentes
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Situação atual */}
        <Card className="p-5 mb-5">
          <View className="flex-row items-center">
            <TierBadge
              icon={tier.icon}
              tone={tier.tone}
              treatment={tier.treatment}
              size={56}
            />
            <View className="flex-1 ml-3">
              <Text
                className="font-jakarta-extrabold text-lg"
                style={{ color: colors[tier.tone] }}
              >
                {tier.name}
              </Text>
              <Text className="text-on-surface-variant font-inter-medium text-sm mt-0.5">
                Nível {level.level} · {level.xp.toLocaleString('pt-BR')} XP
              </Text>
            </View>
          </View>
          <View className="h-2.5 bg-surface-container-high rounded-pill overflow-hidden mt-4">
            <View
              className="h-full rounded-pill"
              style={{
                width: `${Math.max(Math.round(level.progress * 100), 3)}%`,
                backgroundColor: colors[tier.tone],
              }}
            />
          </View>
          <Text className="text-on-surface-variant font-inter-medium text-xs mt-2.5">
            +{xpToNextLevel} XP para o Nível {level.level + 1}
          </Text>
        </Card>

        <Text className="text-outline font-inter-regular text-xs leading-4 mb-4 px-1">
          Cada card revisado vale 1 XP — em qualquer modo (flashcards, quiz ou
          escrever). Subir de nível fica um pouco mais caro a cada nível.
        </Text>

        {/* Todas as patentes */}
        <View className="gap-3">
          {LEVEL_TIERS.map(t => {
            const neededXp = xpForLevelStart(t.minLevel);
            const reached = level.level >= t.minLevel;
            const isCurrent = tier.name === t.name;
            const missing = Math.max(0, neededXp - level.xp);
            const tint = colors[t.tone];

            return (
              <View
                key={t.name}
                className="bg-surface-container rounded-card p-4 flex-row items-center gap-3"
                style={{
                  opacity: reached ? 1 : 0.65,
                  borderWidth: isCurrent ? 1.5 : 0,
                  borderColor: isCurrent ? tint : 'transparent',
                }}
              >
                <TierBadge
                  icon={t.icon}
                  tone={t.tone}
                  treatment={t.treatment}
                  size={48}
                />

                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="font-jakarta-bold text-base"
                      style={{ color: reached ? tint : colors.onSurface }}
                    >
                      {t.name}
                    </Text>
                    {isCurrent && (
                      <View
                        className="rounded-pill px-2 py-0.5"
                        style={{ backgroundColor: tint + '26' }}
                      >
                        <Text
                          className="font-inter-semibold text-[10px]"
                          style={{ color: tint }}
                        >
                          VOCÊ ESTÁ AQUI
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-outline font-inter-regular text-xs mt-0.5">
                    Nível {t.minLevel}
                    {t.minLevel === LEVEL_TIERS[LEVEL_TIERS.length - 1]!.minLevel
                      ? '+'
                      : ''}{' '}
                    · {neededXp.toLocaleString('pt-BR')} XP
                  </Text>
                </View>

                {reached ? (
                  <Ionicons name="checkmark-circle" size={22} color={tint} />
                ) : (
                  <View className="items-end">
                    <Ionicons name="lock-closed" size={16} color={colors.outline} />
                    <Text className="text-outline font-inter-medium text-[11px] mt-1">
                      faltam {missing.toLocaleString('pt-BR')} XP
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text className="text-outline font-inter-regular text-xs text-center mt-6">
          Continue revisando para subir de patente! 🚀
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
