import React from 'react';
import { View, Text } from 'react-native';

interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

export function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
  const config = {
    sm: { container: 'px-2 py-1 gap-1', emoji: 'text-sm', text: 'text-xs' },
    md: { container: 'px-3 py-1.5 gap-1.5', emoji: 'text-base', text: 'text-sm' },
    lg: { container: 'px-4 py-2 gap-2', emoji: 'text-xl', text: 'text-base' },
  }[size];

  return (
    <View
      className={`flex-row items-center bg-tertiary/15 rounded-full ${config.container}`}
    >
      <Text className={config.emoji}>🔥</Text>
      <Text className={`text-tertiary font-jakarta-bold ${config.text}`}>
        {streak} {streak === 1 ? 'dia' : 'dias'}
      </Text>
    </View>
  );
}
