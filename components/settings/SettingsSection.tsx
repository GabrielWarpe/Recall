import React from 'react';
import { View, Text } from 'react-native';

interface SettingsSectionProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

export function SettingsSection({
  title,
  footer,
  children,
}: SettingsSectionProps) {
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View className="mb-6">
      {title != null && (
        <Text className="text-on-surface-variant font-inter-semibold text-xs uppercase mb-2 ml-1">
          {title}
        </Text>
      )}
      <View className="bg-surface-container rounded-card border border-outline-variant/20 overflow-hidden">
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View className="h-px bg-outline-variant/15 ml-[52px]" />}
            {child}
          </View>
        ))}
      </View>
      {footer != null && (
        <Text className="text-outline font-inter-regular text-xs mt-2 ml-1 leading-4">
          {footer}
        </Text>
      )}
    </View>
  );
}
