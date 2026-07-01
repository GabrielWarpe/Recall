import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Deck } from '@/types';
import { useThemeColors } from '@/hooks/useThemeColors';

interface DeckCardProps {
  deck: Deck;
  onPress: () => void;
  /** Quando presente, mostra um botão ▶ que inicia o estudo direto. */
  onStudy?: () => void;
}

export function DeckCard({ deck, onPress, onStudy }: DeckCardProps) {
  const colors = useThemeColors();
  const totalCards = deck.cards.length;
  const studiedLabel =
    deck.lastStudied != null
      ? `Estudado ${formatDistanceToNow(new Date(deck.lastStudied), {
          addSuffix: true,
          locale: ptBR,
        })}`
      : 'Nunca estudado';

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface-container rounded-card p-4 border border-outline-variant/20 flex-row items-center gap-3"
      activeOpacity={0.8}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center"
        style={{ backgroundColor: deck.color + '30' }}
      >
        <Text className="text-xl">{deck.emoji}</Text>
      </View>
      <View className="flex-1">
        <Text
          className="text-on-surface font-jakarta-semibold text-base"
          numberOfLines={1}
        >
          {deck.title}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          <Text className="text-outline font-inter-regular text-xs">
            {totalCards} {totalCards === 1 ? 'card' : 'cards'}
          </Text>
          <Text className="text-outline font-inter-regular text-xs">•</Text>
          <Text
            className="text-outline font-inter-regular text-xs flex-1"
            numberOfLines={1}
          >
            {studiedLabel}
          </Text>
        </View>
      </View>
      {onStudy != null && totalCards > 0 ? (
        <TouchableOpacity
          onPress={onStudy}
          activeOpacity={0.8}
          hitSlop={10}
          className="w-10 h-10 rounded-full bg-primary-container items-center justify-center"
        >
          <Ionicons name="play" size={18} color="#ede0ff" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.outline} />
      )}
    </TouchableOpacity>
  );
}
