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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { Flashcard } from '@/types';
import {
  generateFlashcards,
  generateFlashcardsFromFile,
  makeFlashcard,
} from '@/services/ai';
import { uploadCardImages, type CardImage } from '@/services/images';
import { errorMessage } from '@/utils/errors';
import { useAuth } from '@/contexts/AuthContext';
import { useDecks } from '@/hooks/useDecks';
import { DECK_COLORS } from '@/constants/theme';
import { EmojiPickerField } from '@/components/EmojiPickerField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TagInput } from '@/components/TagInput';
import { CardImagePicker } from '@/components/CardImagePicker';
import { CardImages } from '@/components/CardImages';
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
  const [selectedColor, setSelectedColor] = useState(DECK_COLORS[0]!);
  const [selectedEmoji, setSelectedEmoji] = useState('📚');
  const [tags, setTags] = useState<string[]>([]);

  // Tags já usadas nos outros decks, como sugestão de 1 toque.
  const allTags = [...new Set(decks.flatMap(d => d.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt'),
  );

  // AI mode
  const [aiTopic, setAiTopic] = useState('');
  const [cardCount, setCardCount] = useState('10');
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  // Imagens de CONTEXTO para a IA (página de livro, print, diagrama...).
  const [aiImages, setAiImages] = useState<CardImage[]>([]);

  // Manual mode
  const [manualCards, setManualCards] = useState<Flashcard[]>([]);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  // Imagens do card sendo composto; o preview usa URIs locais e as imagens
  // (com base64) ficam guardadas por card até o upload, na hora de salvar.
  const [newImages, setNewImages] = useState<CardImage[]>([]);
  const pendingImagesRef = useRef<Record<string, CardImage[]>>({});

  const cards = mode === 'ai' ? generatedCards : manualCards;

  const handleGenerate = async () => {
    if (!pickedFile && !aiTopic.trim() && aiImages.length === 0) {
      Alert.alert(
        'Atenção',
        'Digite um tópico, anexe um arquivo ou adicione imagens.',
      );
      return;
    }
    setGenerating(true);
    try {
      const count = Math.min(Math.max(parseInt(cardCount, 10) || 10, 1), 30);
      const raw = pickedFile
        ? await generateFlashcardsFromFile(
            { base64: pickedFile.base64, mimeType: pickedFile.mimeType },
            count,
          )
        : await generateFlashcards(
            aiTopic,
            count,
            // Imagens comprimidas em JPEG viram contexto do prompt.
            aiImages
              .filter(img => img.base64)
              .map(img => ({ base64: img.base64!, mimeType: 'image/jpeg' })),
          );
      setGeneratedCards(raw.map(c => makeFlashcard(c.front, c.back)));
    } catch (e: unknown) {
      Alert.alert('Erro ao gerar cards', errorMessage(e, 'Erro desconhecido'));
    } finally {
      setGenerating(false);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      // .txt continua sendo lido como texto no campo de tópico.
      if (file.mimeType === 'text/plain') {
        const text = await FileSystem.readAsStringAsync(file.uri);
        setAiTopic(text.slice(0, 3000));
        setPickedFile(null);
        return;
      }

      const isPdf = file.mimeType === 'application/pdf';
      const isImage = file.mimeType?.startsWith('image/') ?? false;
      if (!isPdf && !isImage) {
        Alert.alert(
          'Formato não suportado',
          'Selecione um PDF, uma imagem ou um arquivo de texto.',
        );
        return;
      }
      // Limite da API: 32 MB por requisição; o base64 infla ~33%.
      if (file.size != null && file.size > 24 * 1024 * 1024) {
        Alert.alert('Arquivo muito grande', 'Escolha um arquivo de até 24 MB.');
        return;
      }

      const base64 = await new FileSystem.File(file.uri).base64();
      setPickedFile({
        name: file.name,
        base64,
        mimeType: file.mimeType ?? (isPdf ? 'application/pdf' : 'image/jpeg'),
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível ler o arquivo.');
    }
  };

  const handleAddManualCard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    const card = makeFlashcard(
      newFront.trim(),
      newBack.trim(),
      newImages.map(img => img.uri), // URIs locais só para o preview
    );
    if (newImages.length > 0) pendingImagesRef.current[card.id] = newImages;
    setManualCards(c => [...c, card]);
    setNewFront('');
    setNewBack('');
    setNewImages([]);
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
      const payload: { front: string; back: string; images?: string[] }[] = [];
      for (const c of cards) {
        const pending = pendingImagesRef.current[c.id] ?? [];
        const urls =
          pending.length > 0 ? await uploadCardImages(user.id, pending) : [];
        payload.push({
          front: c.front,
          back: c.back,
          ...(urls.length > 0 ? { images: urls } : {}),
        });
      }

      await createDeck({
        title: title.trim(),
        emoji: selectedEmoji,
        color: selectedColor,
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
                    selectedColor === c
                      ? 'border-on-surface scale-110'
                      : 'border-outline-variant/40'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </View>
          </View>

          {/* Tags */}
          <TagInput
            tags={tags}
            onChange={setTags}
            suggestions={allTags}
          />

          {/* Mode tabs */}
          <View className="bg-surface-container-high rounded-card p-1 flex-row">
            {(['ai', 'manual'] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  mode === m ? 'bg-primary-container' : ''
                }`}
              >
                <Text
                  className={`font-inter-semibold text-sm ${
                    mode === m
                      ? 'text-on-primary-container'
                      : 'text-outline'
                  }`}
                >
                  {m === 'ai' ? '✨ Gerar com IA' : '✏️ Manual'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI Mode */}
          {mode === 'ai' && (
            <View className="gap-4">
              <Input
                label="Tópico ou conteúdo"
                placeholder="Ex: Fotossíntese, Hooks do React, Segunda Guerra Mundial..."
                value={aiTopic}
                onChangeText={setAiTopic}
                multiline
                numberOfLines={5}
                style={{ height: 110, textAlignVertical: 'top', paddingTop: 12 }}
              />
              <View className="flex-row gap-3 items-end">
                <View className="flex-1">
                  <Input
                    label="Quantidade de cards"
                    placeholder="10"
                    value={cardCount}
                    onChangeText={setCardCount}
                    keyboardType="number-pad"
                  />
                </View>
                <Button
                  variant="outline"
                  size="md"
                  onPress={() => void handlePickFile()}
                >
                  📎 Arquivo
                </Button>
              </View>

              {pickedFile && (
                <View className="gap-1">
                  <View className="flex-row items-center gap-2 bg-surface-container rounded-card px-3 py-2.5 border border-outline-variant/20">
                    <Ionicons
                      name={
                        pickedFile.mimeType === 'application/pdf'
                          ? 'document-text'
                          : 'image'
                      }
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      className="flex-1 text-on-surface font-inter-medium text-sm"
                      numberOfLines={1}
                    >
                      {pickedFile.name}
                    </Text>
                    <TouchableOpacity onPress={() => setPickedFile(null)}>
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.outline}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-outline font-inter-regular text-xs">
                    Os cards serão gerados a partir deste arquivo.
                  </Text>
                </View>
              )}

              {/* Imagens de contexto para a IA (fotos de página, prints...) */}
              {!pickedFile && (
                <CardImagePicker
                  images={aiImages}
                  onChange={setAiImages}
                  label="Imagens de contexto (opcional)"
                />
              )}

              <Button
                variant="primary"
                size="lg"
                onPress={() => void handleGenerate()}
                loading={generating}
              >
                {generating ? 'Gerando cards...' : '✨ Gerar flashcards'}
              </Button>
            </View>
          )}

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
                  className="bg-surface-container rounded-card p-4 border border-outline-variant/20 gap-2"
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
