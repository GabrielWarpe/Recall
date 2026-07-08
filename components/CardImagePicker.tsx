import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  pickCardImages,
  MAX_IMAGES_PER_CARD,
  type CardImage,
} from '@/services/images';
import { useThemeColors } from '@/hooks/useThemeColors';

const THUMB = 72;

interface CardImagePickerProps {
  images: CardImage[];
  onChange: (images: CardImage[]) => void;
  /** Rótulo acima do editor (padrão: "Imagens (opcional)"). */
  label?: string;
}

/**
 * Editor de imagens de um card: miniaturas com botão de remover + tile de
 * adicionar (abre a galeria com seleção múltipla, já comprimindo).
 */
export function CardImagePicker({
  images,
  onChange,
  label = 'Imagens (opcional)',
}: CardImagePickerProps) {
  const colors = useThemeColors();
  const [picking, setPicking] = useState(false);

  const remaining = MAX_IMAGES_PER_CARD - images.length;

  const handleAdd = async () => {
    if (picking || remaining <= 0) return;
    setPicking(true);
    try {
      const picked = await pickCardImages(remaining);
      if (picked.length > 0) onChange([...images, ...picked]);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar a imagem selecionada.');
    } finally {
      setPicking(false);
    }
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <View className="gap-2">
      <Text className="text-on-surface-variant font-inter-medium text-sm">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {images.map((img, i) => (
          <View key={`${img.uri}:${i}`}>
            <Image
              source={{ uri: img.uri }}
              style={{ width: THUMB, height: THUMB, borderRadius: 12 }}
              className="bg-surface-container-high border border-outline-variant/30"
              resizeMode="cover"
            />
            {/* Remover */}
            <TouchableOpacity
              onPress={() => handleRemove(i)}
              hitSlop={8}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-error items-center justify-center"
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {remaining > 0 && (
          <TouchableOpacity
            onPress={() => void handleAdd()}
            disabled={picking}
            activeOpacity={0.8}
            style={{ width: THUMB, height: THUMB }}
            className="rounded-xl border border-dashed border-outline-variant items-center justify-center bg-surface-container"
          >
            <Ionicons
              name={picking ? 'hourglass-outline' : 'image-outline'}
              size={22}
              color={colors.primary}
            />
            <Text className="text-outline font-inter-regular text-[10px] mt-1">
              {picking ? '...' : 'Adicionar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {images.length > 0 && (
        <Text className="text-outline font-inter-regular text-xs">
          {images.length}/{MAX_IMAGES_PER_CARD} imagens — toque no × para
          remover
        </Text>
      )}
    </View>
  );
}
