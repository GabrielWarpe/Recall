import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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

/**
 * Ícone visual de um deck: a foto de capa, ou o "livrinho" padrão.
 *
 * A foto vive dentro de uma MOLDURA (fundo opaco + recorte + aro interno), e
 * não solta sobre o card. Sem isso, um PNG com transparência deixa o fundo do
 * card vazar e a imagem lê como um recorte mal feito flutuando ali.
 */
export function DeckAvatar({ coverUrl, size = 48, radius = 12 }: DeckAvatarProps) {
  const colors = useThemeColors();

  const frame = {
    width: size,
    height: size,
    borderRadius: radius,
    // Fundo opaco: sustenta imagens com transparência e evita "buraco" no card.
    backgroundColor: colors.surfaceContainerHigh,
    overflow: 'hidden' as const,
  };

  if (coverUrl) {
    return (
      <View style={frame}>
        <Image
          source={{ uri: coverUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          // Entra em fade em vez de aparecer de estalo ao rolar a lista.
          transition={180}
        />
        {/* Aro interno: separa a foto da superfície do card e disfarça a borda
            dura do JPEG. Fica POR CIMA da imagem, por isso é absoluto. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.onSurface + '1F',
            },
          ]}
        />
      </View>
    );
  }

  // Sem capa: pilha de camadas no chip tingido — mesma metáfora de "deck" da
  // aba Decks (`albums`), no lugar de um livro genérico.
  return (
    <View
      className="items-center justify-center"
      style={{ ...frame, backgroundColor: colors.primary + '1F' }}
    >
      <Ionicons name="layers" size={Math.round(size * 0.5)} color={colors.primary} />
    </View>
  );
}
