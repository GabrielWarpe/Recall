import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  View,
} from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-primary-container',
    secondary: 'bg-secondary-container',
    outline: 'border border-outline-variant bg-transparent',
    ghost: 'bg-transparent',
  };

  const sizes: Record<string, string> = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3.5',
    lg: 'px-8 py-4',
  };

  const textVariants: Record<string, string> = {
    primary: 'text-on-primary-container',
    secondary: 'text-on-surface',
    outline: 'text-on-surface',
    ghost: 'text-primary',
  };

  const textSizes: Record<string, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const colors = useThemeColors();
  const isDisabled = disabled ?? false;

  return (
    <TouchableOpacity
      className={`items-center justify-center rounded-button flex-row gap-2 ${variants[variant]} ${sizes[size]} ${isDisabled || loading ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={isDisabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text
          className={`font-inter-semibold ${textVariants[variant]} ${textSizes[size]}`}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}
