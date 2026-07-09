import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { DeckAvatar } from '@/components/DeckAvatar';
import type { CardImportTarget } from '@/services/backup';

interface DeckOption {
  id: string;
  title: string;
  coverUrl: string | null;
}

interface Props {
  visible: boolean;
  decks: DeckOption[];
  cardCount: number;
  /** Nome do baralho de origem (para nomear um baralho novo). */
  sourceTitle: string | null;
  onCancel: () => void;
  onPick: (target: CardImportTarget) => void;
}

/**
 * Escolhe o destino de cartões importados: um baralho existente (append) ou um
 * baralho novo criado com esses cartões.
 */
export function DeckPickerModal({
  visible,
  decks,
  cardCount,
  sourceTitle,
  onCancel,
  onPick,
}: Props) {
  const colors = useThemeColors();
  const newTitle = sourceTitle && sourceTitle.trim() ? sourceTitle : 'Cartões importados';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onCancel}>
        <Pressable
          className="bg-surface-container rounded-t-3xl overflow-hidden"
          style={{ maxHeight: '80%' }}
          onPress={e => e.stopPropagation()}
        >
          <View className="px-5 py-4 border-b border-outline-variant/30">
            <Text className="text-on-surface font-jakarta-bold text-base">
              Adicionar {cardCount} {cardCount === 1 ? 'cartão' : 'cartões'}
            </Text>
            <Text className="text-on-surface-variant font-inter-regular text-sm mt-0.5">
              Escolha um baralho de destino
              {sourceTitle ? ` · de "${sourceTitle}"` : ''}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Novo baralho */}
            <Pressable
              onPress={() => onPick({ type: 'new', title: newTitle })}
              className="flex-row items-center gap-3 rounded-button px-3 py-3 mb-1"
            >
              <View
                className="w-11 h-11 rounded-button items-center justify-center"
                style={{ backgroundColor: colors.primary + '22' }}
              >
                <Ionicons name="add" size={22} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-on-surface font-inter-semibold text-[15px]">
                  Novo baralho
                </Text>
                <Text className="text-outline font-inter-regular text-xs mt-0.5">
                  Cria "{newTitle}" com esses cartões
                </Text>
              </View>
            </Pressable>

            {decks.length > 0 && (
              <Text className="text-outline font-inter-semibold text-xs tracking-widest px-3 mt-3 mb-1">
                OU ADICIONAR A
              </Text>
            )}

            {decks.map(d => (
              <Pressable
                key={d.id}
                onPress={() => onPick({ type: 'existing', deckId: d.id })}
                className="flex-row items-center gap-3 rounded-button px-3 py-2.5"
              >
                <DeckAvatar coverUrl={d.coverUrl} size={44} radius={12} />
                <Text
                  className="flex-1 text-on-surface font-inter-medium text-[15px]"
                  numberOfLines={1}
                >
                  {d.title}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.outline}
                />
              </Pressable>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.8}
            className="py-4 items-center border-t border-outline-variant/30"
          >
            <Text className="text-on-surface-variant font-inter-medium text-sm">
              Cancelar
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
