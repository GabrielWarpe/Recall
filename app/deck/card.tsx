import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/services/database';
import { uploadCardImages, type CardImage } from '@/services/images';
import { errorMessage } from '@/utils/errors';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CardImagePicker } from '@/components/CardImagePicker';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function CardEditorScreen() {
  const { deckId, cardId } = useLocalSearchParams<{
    deckId: string;
    cardId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();

  const isEditing = cardId != null && cardId.length > 0;
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  // Imagens do card: as existentes entram só com a URL; novas trazem base64.
  const [images, setImages] = useState<CardImage[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEditing || !cardId) return;
    void db.flashcards.getOne(cardId).then(c => {
      if (c) {
        setFront(c.front);
        setBack(c.back);
        setImages((c.images ?? []).map(uri => ({ uri })));
      }
      setLoading(false);
    });
  }, [isEditing, cardId]);

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) {
      Alert.alert('Atenção', 'Preencha a frente e o verso do card.');
      return;
    }
    if (!user || !deckId) return;
    setSaving(true);
    try {
      // Sobe as imagens novas (as existentes passam direto como URL).
      const urls = await uploadCardImages(user.id, images);
      if (isEditing && cardId) {
        await db.flashcards.update(cardId, {
          front: front.trim(),
          back: back.trim(),
          images: urls,
        });
      } else {
        await db.decks.addCards(user.id, deckId, [
          {
            front: front.trim(),
            back: back.trim(),
            ...(urls.length > 0 ? { images: urls } : {}),
          },
        ]);
      }
      router.back();
    } catch (e: unknown) {
      Alert.alert('Erro', errorMessage(e, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!cardId) return;
    Alert.alert('Excluir card', 'Deseja excluir este card?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await db.flashcards.delete(cardId);
          router.back();
        },
      },
    ]);
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
            {isEditing ? 'Editar card' : 'Novo card'}
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
            contentContainerStyle={{ padding: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Input
              label="Frente do card"
              placeholder="Pergunta ou conceito..."
              value={front}
              onChangeText={setFront}
              multiline
              numberOfLines={3}
              style={{ height: 90, textAlignVertical: 'top', paddingTop: 12 }}
            />
            <Input
              label="Verso do card"
              placeholder="Resposta ou explicação..."
              value={back}
              onChangeText={setBack}
              multiline
              numberOfLines={4}
              style={{ height: 120, textAlignVertical: 'top', paddingTop: 12 }}
            />

            <CardImagePicker images={images} onChange={setImages} />

            {isEditing && (
              <Button
                variant="outline"
                size="md"
                className="mt-2 border-error/40"
                onPress={handleDelete}
              >
                <Text className="text-error font-inter-semibold">
                  Excluir card
                </Text>
              </Button>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
