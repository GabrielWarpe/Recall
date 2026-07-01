import React from 'react';
import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error';
}

export function Badge({ label, variant = 'primary' }: BadgeProps) {
  const containerVariants: Record<string, string> = {
    primary: 'bg-primary/20',
    secondary: 'bg-secondary-container',
    tertiary: 'bg-tertiary/20',
    error: 'bg-error/20',
  };

  const textVariants: Record<string, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    tertiary: 'text-tertiary',
    error: 'text-error',
  };

  return (
    <View className={`px-2.5 py-1 rounded-full ${containerVariants[variant]}`}>
      <Text className={`font-inter-medium text-xs ${textVariants[variant]}`}>
        {label}
      </Text>
    </View>
  );
}
