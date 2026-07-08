import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/database';
import { errorMessage } from '@/utils/errors';
import { useDecks } from '@/hooks/useDecks';
import { DECK_COLORS, resolveDeckColor } from '@/constants/theme';
import { EmojiPickerField } from '@/components/EmojiPickerField';
import { Input } from '@/components/ui/Input';
import { TagInput } from '@/components/TagInput';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { decks } = useDecks();

  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(DECK_COLORS[0]!);
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tags dos demais decks, como sugestão de 1 toque.
  const allTags = [
    ...new Set(decks.filter(d => d.id !== id).flatMap(d => d.tags)),
  ].sort((a, b) => a.localeCompare(b, 'pt'));

  useEffect(() => {
    if (!id) return;
    void db.decks.getOne(id).then(d => {
      if (d) {
        setTitle(d.title);
        setSelectedColor(d.color);
        setSelectedEmoji(d.emoji);
        setTags(d.tags);
      }
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Dê um título ao deck.');
      return;
    }
    if (!id) return;
    setSaving(true);
    try {
      const base = {
        name: title.trim(),
        emoji: selectedEmoji,
        color: selectedColor,
      };
      try {
        await db.playlists.update(id, { ...base, tags });
      } catch (e) {
        // Banco sem a coluna `tags`: salva os demais campos mesmo assim.
        if (/tags/i.test(errorMessage(e, ''))) {
          await db.playlists.update(id, base);
        } else {
          throw e;
        }
      }
      router.back();
    } catch (e: unknown) {
      Alert.alert('Erro', errorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-2 pb-4 border-b border-outline-variant/20">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons name="close" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-on-surface font-jakarta-bold text-lg">
            Editar deck
          </Text>
          <TouchableOpacity
            onPress={() => void handleSave()}
            className="p-2"
            disabled={saving || loading}
          >
            <Text className="text-primary font-inter-semibold text-base">
              {saving ? 'Salvando...' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? null : (
          <ScrollView
            contentContainerStyle={{ padding: 24, gap: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Input
              label="Título do deck"
              placeholder="Ex: Biologia Celular..."
              value={title}
              onChangeText={setTitle}
            />

            {/* Emoji picker */}
            <View className="gap-2">
              <Text className="text-on-surface-variant font-inter-medium text-sm">
                Ícone
              </Text>
              <EmojiPickerField value={selectedEmoji} onChange={setSelectedEmoji} />
            </View>

            {/* Color picker */}
            <View className="gap-2">
              <Text className="text-on-surface-variant font-inter-medium text-sm">
                Cor
              </Text>
              <View className="flex-row gap-3 flex-wrap">
                {DECK_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    className={`w-9 h-9 rounded-full border-2 ${
                      resolveDeckColor(selectedColor) === c
                        ? 'border-on-surface scale-110'
                        : 'border-outline-variant/40'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
            </View>

            {/* Tags */}
            <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
