import React, { useState } from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const colors = useThemeColors();

  return (
    <View className="gap-1.5">
      {label != null && (
        <Text className="text-on-surface-variant font-inter-medium text-sm">{label}</Text>
      )}
      <TextInput
        className={`bg-surface-container-high rounded-button px-4 py-3.5 text-on-surface font-inter-regular text-base border ${
          error != null
            ? 'border-error'
            : focused
              ? 'border-primary'
              : 'border-outline-variant'
        } ${className ?? ''}`}
        placeholderTextColor={colors.outline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={style}
        {...props}
      />
      {error != null && (
        <Text className="text-error font-inter-regular text-xs">{error}</Text>
      )}
      {hint != null && error == null && (
        <Text className="text-outline font-inter-regular text-xs">{hint}</Text>
      )}
    </View>
  );
}
