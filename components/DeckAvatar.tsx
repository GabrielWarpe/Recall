import React from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface DeckAvatarProps {
  /** URL da capa; se ausente, mostra o ícone padrão "livrinho". */
  coverUrl?: string | null;
  /** Lado do quadrado, em px. */
  size?: number;
  /** Raio dos cantos, em px. */
  radius?: number;
}

/** Ícone visual de um deck: a foto de capa, ou o "livrinho" padrão. */
export function DeckAvatar({ coverUrl, size = 48, radius = 12 }: DeckAvatarProps) {
  const colors = useThemeColors();

  if (coverUrl) {
    return (
      <Image
        source={{ uri: coverUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.primary + '22',
      }}
    >
      <Ionicons name="book" size={Math.round(size * 0.5)} color={colors.primary} />
    </View>
  );
}
