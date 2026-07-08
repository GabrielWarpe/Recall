import React, { useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  Text,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

interface CardImagesProps {
  /** URLs (ou URIs locais) das imagens do card. */
  images: string[];
  /** Lado das miniaturas, em px. */
  size?: number;
}

/**
 * Miniaturas das imagens de um card + visualizador em tela cheia ao tocar.
 * Usado na frente do flashcard, nas perguntas do quiz/escrever e nos previews.
 */
export function CardImages({ images, size = 64 }: CardImagesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const colors = useThemeColors();

  if (images.length === 0) return null;

  return (
    <>
      <View className="flex-row flex-wrap gap-2 justify-center">
        {images.map((uri, i) => (
          <TouchableOpacity
            key={`${uri}:${i}`}
            onPress={() => setOpenIndex(i)}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              style={{
                width: size,
                height: size,
                borderRadius: 10,
                backgroundColor: colors.surfaceContainerHigh,
                borderWidth: 1,
                borderColor: colors.outlineVariant + '4D',
              }}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Visualizador em tela cheia (toque na imagem para ampliar) */}
      <Modal
        visible={openIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenIndex(null)}
      >
        <Pressable
          className="flex-1 bg-black/90 items-center justify-center"
          onPress={() => setOpenIndex(null)}
        >
          {openIndex !== null && images[openIndex] != null && (
            <Image
              source={{ uri: images[openIndex] }}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
              style={{ width: '100%', height: '80%' }}
            />
          )}
          <TouchableOpacity
            onPress={() => setOpenIndex(null)}
            className="absolute top-14 right-5 w-10 h-10 rounded-full bg-white/15 items-center justify-center"
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {images.length > 1 && openIndex !== null && (
            <View className="absolute bottom-12">
              <Text className="text-white/70 font-inter-medium text-sm">
                {openIndex + 1} de {images.length} — toque para fechar
              </Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
