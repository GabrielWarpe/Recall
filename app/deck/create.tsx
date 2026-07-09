import React, { useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Flashcard } from '@/types';
import { makeFlashcard } from '@/services/ai';
import { AiGeneratorForm } from '@/components/AiGeneratorForm';
import {
  uploadCardImages,
  imageToDataUri,
  type CardImage,
} from '@/services/images';
import { errorMessage } from '@/utils/errors';
import { useAuth } from '@/contexts/AuthContext';
import { useDecks } from '@/hooks/useDecks';
import { DeckCoverPicker } from '@/components/DeckCoverPicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { TagInput } from '@/components/TagInput';
import { CardImagePicker } from '@/components/CardImagePicker';
import { CardImages } from '@/components/CardImages';
import {
  QuizOptionsInput,
  filledQuizOptions,
} from '@/components/QuizOptionsInput';
import { useThemeColors } from '@/hooks/useThemeColors';

type Mode = 'ai' | 'manual';

export default function CreateDeckScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createDeck, decks } = useDecks();
  const colors = useThemeColors();
  const [mode, setMode] = useState<Mode>('ai');
  const [saving, setSaving] = useState(false);

  // Deck metadata
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<CardImage | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  // Tags já usadas nos outros decks, como sugestão de 1 toque.
  const allTags = [...new Set(decks.flatMap(d => d.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt'),
  );

  // AI mode (o formulário em si vive no AiGeneratorForm)
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);

  // Manual mode
  const [manualCards, setManualCards] = useState<Flashcard[]>([]);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  // Alternativas ERRADAS do quiz (opcionais; 2+ tornam o card uma pergunta).
  const [newQuizOptions, setNewQuizOptions] = useState<string[]>([]);
  // Imagens do card sendo composto; o preview usa URIs locais e as imagens
  // (com base64) ficam guardadas por card até o upload, na hora de salvar.
  const [newImages, setNewImages] = useState<CardImage[]>([]);
  const pendingImagesRef = useRef<Record<string, CardImage[]>>({});

  const cards = mode === 'ai' ? generatedCards : manualCards;

  const handleAddManualCard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const wrongOptions = filledQuizOptions(newQuizOptions);
    if (wrongOptions.length === 1) {
      Alert.alert(
        'Quiz incompleto',
        'Uma pergunta de quiz precisa de pelo menos 2 alternativas erradas (3 opções no total). Complete ou deixe todas vazias.',
      );
      return;
    }
    const card = makeFlashcard(
      newFront.trim(),
      newBack.trim(),
      newImages.map(img => img.uri), // URIs locais só para o preview
      wrongOptions,
    );
    if (newImages.length > 0) pendingImagesRef.current[card.id] = newImages;
    setManualCards(c => [...c, card]);
    setNewFront('');
    setNewBack('');
    setNewImages([]);
    setNewQuizOptions([]);
  };

  const handleRemoveCard = (id: string) => {
    delete pendingImagesRef.current[id];
    if (mode === 'ai') {
      setGeneratedCards(c => c.filter(x => x.id !== id));
    } else {
      setManualCards(c => c.filter(x => x.id !== id));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Dê um título ao deck.');
      return;
    }
    if (cards.length === 0) {
      Alert.alert(
        'Atenção',
        mode === 'ai'
          ? 'Gere os cards antes de salvar.'
          : 'Adicione pelo menos um card.',
      );
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      // Sobe as imagens dos cards manuais (com dedupe) e monta o payload
      // final com as URLs públicas.
      const payload: {
        front: string;
        back: string;
        images?: string[];
        quizOptions?: string[];
      }[] = [];
      for (const c of cards) {
        const pending = pendingImagesRef.current[c.id] ?? [];
        const urls =
          pending.length > 0 ? await uploadCardImages(user.id, pending) : [];
        payload.push({
          front: c.front,
          back: c.back,
          ...(urls.length > 0 ? { images: urls } : {}),
          ...(c.quizOptions.length > 0 ? { quizOptions: c.quizOptions } : {}),
        });
      }

      // Capa (se houver) vira data URI base64 salvo direto no deck — sem Storage.
      const coverUrl = cover ? imageToDataUri(cover) : null;

      await createDeck({
        title: title.trim(),
        description: description.trim() || undefined,
        emoji: '',
        color: '',
        coverUrl,
        sourceType: mode === 'ai' ? 'ai' : 'manual',
        tags,
        cards: payload,
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Erro', errorMessage(e, 'Erro ao salvar o deck.'));
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
            Novo deck
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
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingVertical: 20,
            gap: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title & description */}
          <View className="gap-4">
            <Input
              label="Título do deck *"
              placeholder="Ex: Biologia Celular, React Hooks..."
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Descrição (opcional)"
              placeholder="Breve descrição do conteúdo..."
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Capa do deck */}
          <DeckCoverPicker cover={cover} onChange={setCover} />

          {/* Tags */}
          <TagInput
            tags={tags}
            onChange={setTags}
            suggestions={allTags}
          />

          {/* Mode tabs */}
          <View className="bg-surface-container-high rounded-card p-1 flex-row">
            {(['ai', 'manual'] as Mode[]).map(m => {
              const active = mode === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-button items-center flex-row justify-center gap-1.5 ${
                    active ? 'bg-primary-container' : ''
                  }`}
                >
                  <Ionicons
                    name={m === 'ai' ? 'flash' : 'create-outline'}
                    size={15}
                    color={active ? colors.onPrimaryContainer : colors.outline}
                  />
                  <Text
                    className={`font-inter-semibold text-sm ${
                      active ? 'text-on-primary-container' : 'text-outline'
                    }`}
                  >
                    {m === 'ai' ? 'Gerar com IA' : 'Manual'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* AI Mode */}
          {mode === 'ai' && <AiGeneratorForm onGenerated={setGeneratedCards} />}

          {/* Manual Mode */}
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
              <CardImagePicker images={newImages} onChange={setNewImages} />
              <QuizOptionsInput
                options={newQuizOptions}
                onChange={setNewQuizOptions}
              />
              <Button
                variant="secondary"
                size="md"
                onPress={handleAddManualCard}
                disabled={!newFront.trim() || !newBack.trim()}
              >
                + Adicionar card
              </Button>
            </View>
          )}

          {/* Cards preview */}
          {cards.length > 0 && (
            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-on-surface font-jakarta-bold text-base">
                  {mode === 'ai' ? 'Cards gerados' : 'Cards'} ({cards.length})
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    mode === 'ai'
                      ? setGeneratedCards([])
                      : setManualCards([])
                  }
                >
                  <Text className="text-error font-inter-medium text-xs">
                    Limpar tudo
                  </Text>
                </TouchableOpacity>
              </View>
              {cards.map((card, i) => (
                <View
                  key={card.id}
                  className="bg-surface-container rounded-card p-4 gap-2"
                  style={cardShadow}
                >
                  <View className="flex-row items-start gap-2">
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
                      {card.images.length > 0 && (
                        <View className="mt-2 items-start">
                          <CardImages images={card.images} size={44} />
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveCard(card.id)}
                      className="p-1"
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.outline}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
