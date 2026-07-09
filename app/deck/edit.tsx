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
import { useAuth } from '@/contexts/AuthContext';
import { useDecks } from '@/hooks/useDecks';
import { uploadCardImages, type CardImage } from '@/services/images';
import { DeckCoverPicker } from '@/components/DeckCoverPicker';
import { Input } from '@/components/ui/Input';
import { TagInput } from '@/components/TagInput';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function EditDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuth();
  const { decks } = useDecks();

  const [title, setTitle] = useState('');
  const [cover, setCover] = useState<CardImage | null>(null);
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
        setCover(d.coverUrl ? { uri: d.coverUrl } : null);
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
    if (!id || !user) return;
    setSaving(true);
    try {
      // Sobe a capa nova (se houver) e guarda a URL; sem capa → null.
      const coverUrl = cover
        ? ((await uploadCardImages(user.id, [cover]))[0] ?? null)
        : null;
      const base = { name: title.trim(), cover_url: coverUrl };
      try {
        await db.playlists.update(id, { ...base, tags });
      } catch (e) {
        // Banco sem `tags`/`cover_url`: salva o que der em vez de quebrar.
        if (/tags|cover_url/i.test(errorMessage(e, ''))) {
          await db.playlists.update(id, { name: title.trim() });
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

            {/* Capa do deck */}
            <DeckCoverPicker cover={cover} onChange={setCover} />

            {/* Tags */}
            <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
