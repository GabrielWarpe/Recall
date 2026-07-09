import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickCardImages, type CardImage } from '@/services/images';
import { useThemeColors } from '@/hooks/useThemeColors';

interface DeckCoverPickerProps {
  /** Capa atual em edição (uri de preview + base64 se for nova). */
  cover: CardImage | null;
  onChange: (cover: CardImage | null) => void;
}

/** Seletor da foto de capa do deck (galeria). Sem foto → ícone "livrinho". */
export function DeckCoverPicker({ cover, onChange }: DeckCoverPickerProps) {
  const colors = useThemeColors();

  const pick = async () => {
    const picked = await pickCardImages(1);
    if (picked[0]) onChange(picked[0]);
  };

  return (
    <View className="gap-2">
      <Text className="text-on-surface-variant font-inter-medium text-sm">
        Capa do deck
      </Text>
      <View className="flex-row items-center gap-4">
        <TouchableOpacity onPress={() => void pick()} activeOpacity={0.85}>
          {cover ? (
            <Image
              source={{ uri: cover.uri }}
              style={{ width: 72, height: 72, borderRadius: 14 }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="items-center justify-center"
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                backgroundColor: colors.primary + '22',
              }}
            >
              <Ionicons name="book" size={32} color={colors.primary} />
            </View>
          )}
        </TouchableOpacity>

        <View className="flex-1 gap-1.5">
          <TouchableOpacity onPress={() => void pick()} activeOpacity={0.7}>
            <Text className="text-primary font-inter-semibold text-sm">
              {cover ? 'Trocar foto' : 'Escolher da galeria'}
            </Text>
          </TouchableOpacity>
          {cover ? (
            <TouchableOpacity onPress={() => onChange(null)} activeOpacity={0.7}>
              <Text className="text-error font-inter-medium text-sm">Remover</Text>
            </TouchableOpacity>
          ) : (
            <Text className="text-outline font-inter-regular text-xs leading-4">
              Sem foto, o deck usa o ícone padrão.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
