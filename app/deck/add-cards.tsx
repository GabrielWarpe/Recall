import React, { useState } from 'react';
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
import type { Flashcard } from '@/types';
import { db } from '@/services/database';
import { generateFlashcards, makeFlashcard } from '@/services/ai';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

type Mode = 'manual' | 'ai';

export default function AddCardsScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();

  const [mode, setMode] = useState<Mode>('manual');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [saving, setSaving] = useState(false);

  // Manual
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');

  // AI
  const [aiTopic, setAiTopic] = useState('');
  const [cardCount, setCardCount] = useState('10');
  const [generating, setGenerating] = useState(false);

  const handleAddManual = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    setCards(c => [...c, makeFlashcard(newFront.trim(), newBack.trim())]);
    setNewFront('');
    setNewBack('');
  };

  const handleGenerate = async () => {
    if (!aiTopic.trim()) {
      Alert.alert('Atenção', 'Digite um tópico para gerar os cards.');
      return;
    }
    setGenerating(true);
    try {
      const count = Math.min(Math.max(parseInt(cardCount, 10) || 10, 1), 30);
      const raw = await generateFlashcards(aiTopic, count);
      setCards(prev => [
        ...prev,
        ...raw.map(c => makeFlashcard(c.front, c.back)),
      ]);
      setAiTopic('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      Alert.alert('Erro ao gerar cards', msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleRemove = (cardId: string) => {
    setCards(c => c.filter(x => x.id !== cardId));
  };

  const handleSave = async () => {
    if (cards.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um card.');
      return;
    }
    if (!user || !deckId) return;
    setSaving(true);
    try {
      await db.decks.addCards(
        user.id,
        deckId,
        cards.map(c => ({ front: c.front, back: c.back })),
      );
      router.back();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar.';
      Alert.alert('Erro', msg);
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
            Adicionar cards
          </Text>
          <TouchableOpacity
            onPress={() => void handleSave()}
            className="p-2"
            disabled={saving}
          >
            <Text className="text-primary font-inter-semibold text-base">
              {saving ? 'Salvando...' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode tabs */}
          <View className="bg-surface-container-high rounded-card p-1 flex-row">
            {(['manual', 'ai'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  mode === m ? 'bg-primary-container' : ''
                }`}
              >
                <Text
                  className={`font-inter-semibold text-sm ${
                    mode === m ? 'text-on-primary-container' : 'text-outline'
                  }`}
                >
                  {m === 'manual' ? '✏️ Manual' : '✨ Gerar com IA'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Manual */}
          {mode === 'manual' && (
            <View className="gap-3">
              <Input
                label="Frente do card"
                placeholder="Pergunta ou conceito..."
                value={newFront}
                onChangeText={setNewFront}
              />
              <Input
                label="Verso do card"
                placeholder="Resposta ou explicação..."
                value={newBack}
                onChangeText={setNewBack}
                multiline
                numberOfLines={3}
                style={{ height: 80, textAlignVertical: 'top', paddingTop: 12 }}
              />
              <Button
                variant="secondary"
                size="md"
                onPress={handleAddManual}
                disabled={!newFront.trim() || !newBack.trim()}
              >
                + Adicionar à lista
              </Button>
            </View>
          )}

          {/* AI */}
          {mode === 'ai' && (
            <View className="gap-3">
              <Input
                label="Tópico ou conteúdo"
                placeholder="Ex: Fotossíntese, Hooks do React..."
                value={aiTopic}
                onChangeText={setAiTopic}
                multiline
                numberOfLines={4}
                style={{ height: 90, textAlignVertical: 'top', paddingTop: 12 }}
              />
              <Input
                label="Quantidade de cards"
                placeholder="10"
                value={cardCount}
                onChangeText={setCardCount}
                keyboardType="number-pad"
              />
              <Button
                variant="primary"
                size="md"
                onPress={() => void handleGenerate()}
                loading={generating}
              >
                {generating ? 'Gerando...' : '✨ Gerar e adicionar'}
              </Button>
            </View>
          )}

          {/* Lista a anexar */}
          {cards.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-on-surface font-jakarta-bold text-base">
                  A adicionar ({cards.length})
                </Text>
                <TouchableOpacity onPress={() => setCards([])}>
                  <Text className="text-error font-inter-medium text-xs">
                    Limpar
                  </Text>
                </TouchableOpacity>
              </View>
              {cards.map((card, i) => (
                <View
                  key={card.id}
                  className="bg-surface-container rounded-card p-4 border border-outline-variant/20 flex-row items-start gap-2"
                >
                  <Text className="text-outline font-inter-regular text-xs mt-0.5">
                    {i + 1}.
                  </Text>
                  <View className="flex-1">
                    <Text className="text-on-surface font-inter-medium text-sm leading-5">
                      {card.front}
                    </Text>
                    <Text className="text-outline font-inter-regular text-xs mt-1.5 leading-4">
                      {card.back}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(card.id)}
                    className="p-1"
                  >
                    <Ionicons name="close-circle" size={18} color={colors.outline} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
