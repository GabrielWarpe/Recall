import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

export const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 24;

/** Normaliza uma tag digitada: apara e colapsa espaços internos. */
function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Tags já usadas em outros decks, oferecidas como sugestão de 1 toque. */
  suggestions?: string[];
}

/**
 * Editor de tags do deck: chips removíveis + campo para adicionar + sugestões
 * das tags já existentes. Duplicatas são ignoradas (comparação sem caixa).
 */
export function TagInput({ tags, onChange, suggestions = [] }: TagInputProps) {
  const colors = useThemeColors();
  const [draft, setDraft] = useState('');

  const atLimit = tags.length >= MAX_TAGS;

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || atLimit) return;
    const exists = tags.some(t => t.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...tags, tag]);
    setDraft('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const visibleSuggestions = suggestions
    .filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 8);

  return (
    <View className="gap-2">
      <Text className="text-on-surface-variant font-inter-medium text-sm">
        Tags (opcional)
      </Text>

      {/* Tags escolhidas */}
      {tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {tags.map(tag => (
            <TouchableOpacity
              key={tag}
              onPress={() => removeTag(tag)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 bg-primary/15 border border-primary/40 rounded-full px-3 py-1.5"
            >
              <Text className="text-primary font-inter-medium text-xs">
                #{tag}
              </Text>
              <Ionicons name="close" size={12} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Campo de adição */}
      {!atLimit ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => addTag(draft)}
          placeholder="Ex: inglês, prova, capítulo 3..."
          placeholderTextColor={colors.outline}
          returnKeyType="done"
          submitBehavior="submit"
          maxLength={MAX_TAG_LENGTH}
          className="bg-surface-container rounded-button px-4 py-3 text-on-surface font-inter-regular text-sm border border-outline-variant/30"
          selectionColor={colors.primary}
        />
      ) : (
        <Text className="text-outline font-inter-regular text-xs">
          Máximo de {MAX_TAGS} tags por deck.
        </Text>
      )}

      {/* Sugestões (tags já usadas em outros decks) */}
      {!atLimit && visibleSuggestions.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {visibleSuggestions.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => addTag(s)}
              activeOpacity={0.7}
              className="bg-surface-container-high rounded-full px-3 py-1.5"
            >
              <Text className="text-outline font-inter-regular text-xs">
                + {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
