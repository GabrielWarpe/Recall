import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useStreak } from '@/hooks/useStreak';
import { useThemeColors } from '@/hooks/useThemeColors';
import { StreakBadge } from '@/components/StreakBadge';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { streak, longestStreak } = useStreak();
  const colors = useThemeColors();

  const name = profile?.name ?? 'Estudante';
  const email = user?.email ?? '';
  const initial = (name.trim()[0] ?? 'R').toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-on-surface font-jakarta-extrabold text-2xl">
            Perfil
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            className="w-10 h-10 items-center justify-center rounded-xl bg-surface-container"
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* User card */}
        <View className="bg-surface-container rounded-card p-5 border border-outline-variant/20 items-center">
          <View className="w-20 h-20 rounded-full bg-primary-container items-center justify-center mb-3">
            <Text className="text-on-primary-container font-jakarta-extrabold text-3xl">
              {initial}
            </Text>
          </View>
          <Text className="text-on-surface font-jakarta-bold text-xl">
            {name}
          </Text>
          {email.length > 0 && (
            <Text className="text-outline font-inter-regular text-sm mt-0.5">
              {email}
            </Text>
          )}
          <View className="mt-3">
            <StreakBadge streak={streak} size="md" />
          </View>
        </View>

        {/* Quick stats */}
        <View className="flex-row gap-3 mt-4">
          <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
            <Text className="text-on-surface font-jakarta-extrabold text-2xl">
              {streak}
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              Sequência atual
            </Text>
          </View>
          <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
            <Text className="text-on-surface font-jakarta-extrabold text-2xl">
              {Math.max(longestStreak, streak)}
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              Recorde
            </Text>
          </View>
          <View className="flex-1 bg-surface-container rounded-card p-4 items-center border border-outline-variant/20">
            <Text className="text-on-surface font-jakarta-extrabold text-2xl">
              {profile?.daily_goal ?? 20}
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              Meta diária
            </Text>
          </View>
        </View>

        {/* Atalho para configurações */}
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          activeOpacity={0.8}
          className="flex-row items-center gap-3 px-4 py-3.5 bg-surface-container rounded-card border border-outline-variant/20 mt-6"
        >
          <View className="w-9 h-9 rounded-xl items-center justify-center bg-surface-container-high">
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-on-surface font-inter-medium text-sm">
              Configurações
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              Conta, estudo, notificações e mais
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.outline} />
        </TouchableOpacity>

        <Text className="text-outline font-inter-regular text-xs text-center mt-8">
          Recall v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
