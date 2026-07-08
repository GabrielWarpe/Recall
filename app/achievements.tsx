import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENTS, getUnlocked } from '@/services/achievements';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuth } from '@/contexts/AuthContext';

/** Separa o emoji do começo do título ("🎉 Primeiro deck!" → 🎉 + texto). */
function splitTitle(title: string): { emoji: string; label: string } {
  const spaceIdx = title.indexOf(' ');
  if (spaceIdx <= 0) return { emoji: '⭐', label: title };
  return {
    emoji: title.slice(0, spaceIdx),
    label: title.slice(spaceIdx + 1),
  };
}

export default function AchievementsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getUnlocked(user.id).then(ids => setUnlocked(new Set(ids)));
    }, [user?.id]),
  );

  const unlockedCount = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
  const total = ACHIEVEMENTS.length;
  const progress = total > 0 ? unlockedCount / total : 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3 border-b border-outline-variant/15">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text className="flex-1 text-on-surface font-jakarta-bold text-lg ml-1">
          Conquistas
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Progresso geral */}
        <View className="bg-surface-container rounded-card p-5 border border-outline-variant/20 mb-5">
          <View className="flex-row items-end justify-between mb-3">
            <Text className="text-on-surface font-jakarta-bold text-lg">
              Seu progresso
            </Text>
            <Text className="text-primary font-jakarta-extrabold text-xl">
              {unlockedCount}
              <Text className="text-outline font-inter-regular text-sm">
                {' '}
                / {total}
              </Text>
            </Text>
          </View>
          <View className="h-2 bg-surface-container-high rounded-full overflow-hidden">
            <View
              className="h-full rounded-full bg-primary-container"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>

        {/* Lista de conquistas */}
        <View className="gap-3">
          {ACHIEVEMENTS.map(a => {
            const isUnlocked = unlocked.has(a.id);
            const { emoji, label } = splitTitle(a.title);
            return (
              <View
                key={a.id}
                className="bg-surface-container rounded-card p-4 border border-outline-variant/20 flex-row items-center gap-3"
                style={{ opacity: isUnlocked ? 1 : 0.55 }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: isUnlocked
                      ? colors.primaryContainer + '33'
                      : colors.surfaceContainerHigh,
                  }}
                >
                  {isUnlocked ? (
                    <Text className="text-2xl">{emoji}</Text>
                  ) : (
                    <Ionicons
                      name="lock-closed"
                      size={20}
                      color={colors.outline}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-on-surface font-jakarta-bold text-base">
                    {label}
                  </Text>
                  <Text className="text-outline font-inter-regular text-xs mt-0.5 leading-4">
                    {a.body}
                  </Text>
                </View>
                {isUnlocked && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </View>
            );
          })}
        </View>

        <Text className="text-outline font-inter-regular text-xs text-center mt-6">
          Continue estudando para desbloquear todas! 🚀
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
