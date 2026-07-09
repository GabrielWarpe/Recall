import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { Flashcard } from '@/types';
import {
  generateCards,
  quizQuestionToCard,
  detectFileContentType,
  type GenerateContentType,
  type GenerateMode,
} from '@/lib/api/generateCards';
import { makeFlashcard } from '@/services/ai';
import { pickCardImages } from '@/services/images';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';

/** Anexo único da geração: PDF, Word (.docx) ou imagem, já em base64. */
interface Attachment {
  name: string;
  base64: string;
  contentType: Exclude<GenerateContentType, 'text'>;
}

const ATTACHMENT_ICON: Record<Attachment['contentType'], string> = {
  pdf: 'document-text',
  docx: 'document-text',
  image: 'image',
};

interface AiGeneratorFormProps {
  /** Recebe os cards gerados, já no modelo do app (quiz vira quizOptions). */
  onGenerated: (cards: Flashcard[]) => void;
}

/**
 * Formulário de geração por IA (Edge Function `generate-cards`): tópico/texto
 * OU um anexo (PDF, Word, foto), modo flashcards×quiz e quantidade. Usado na
 * criação de deck e em "adicionar cards".
 */
export function AiGeneratorForm({ onGenerated }: AiGeneratorFormProps) {
  const colors = useThemeColors();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState('10');
  const [genMode, setGenMode] = useState<GenerateMode>('flashcards');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [generating, setGenerating] = useState(false);

  // ── Anexos ─────────────────────────────────────────────────────────────────

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      // .txt vira texto direto no campo de tópico.
      if (file.mimeType === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await FileSystem.readAsStringAsync(file.uri);
        setTopic(text.slice(0, 10_000));
        setAttachment(null);
        return;
      }

      const contentType = detectFileContentType(file.mimeType, file.name);
      if (!contentType) {
        Alert.alert(
          'Formato não suportado',
          'Selecione um PDF, um Word (.docx), uma imagem ou um arquivo de texto.',
        );
        return;
      }
      // Limite da Edge Function/API: base64 infla ~33%.
      if (file.size != null && file.size > 24 * 1024 * 1024) {
        Alert.alert('Arquivo muito grande', 'Escolha um arquivo de até 24 MB.');
        return;
      }

      const base64 = await new FileSystem.File(file.uri).base64();
      setAttachment({ name: file.name, base64, contentType });
    } catch {
      Alert.alert('Erro', 'Não foi possível ler o arquivo.');
    }
  };

  const pickPhoto = async () => {
    // Reusa o pipeline das imagens de card: redimensiona e comprime em JPEG.
    const picked = await pickCardImages(1);
    const img = picked[0];
    if (!img?.base64) return;
    setAttachment({
      name: 'Foto da galeria',
      base64: img.base64,
      contentType: 'image',
    });
  };

  // ── Geração ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!attachment && !topic.trim()) {
      Alert.alert('Atenção', 'Digite um tópico/texto ou anexe um arquivo.');
      return;
    }
    setGenerating(true);
    try {
      const n = Math.min(Math.max(parseInt(count, 10) || 10, 1), 30);
      const result = await generateCards({
        contentType: attachment?.contentType ?? 'text',
        content: attachment ? attachment.base64 : topic.trim(),
        mode: genMode,
        count: n,
      });

      if (!result.ok) {
        Alert.alert('Não foi possível gerar', result.message);
        return;
      }

      const cards =
        result.mode === 'flashcards'
          ? result.cards.map(c => makeFlashcard(c.front, c.back))
          : result.questions.map(q => {
              const m = quizQuestionToCard(q);
              return makeFlashcard(m.front, m.back, [], m.quizOptions);
            });
      onGenerated(cards);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View className="gap-4">
      <Input
        label="Tópico ou conteúdo"
        placeholder="Ex: Fotossíntese, Hooks do React... (ou cole um texto)"
        value={topic}
        onChangeText={setTopic}
        multiline
        numberOfLines={5}
        style={{ height: 110, textAlignVertical: 'top', paddingTop: 12 }}
      />

      <View className="flex-row gap-3 items-end">
        <View className="flex-1">
          <Input
            label="Quantidade"
            placeholder="10"
            value={count}
            onChangeText={setCount}
            keyboardType="number-pad"
          />
        </View>
        <Button variant="outline" size="md" onPress={() => void pickFile()}>
          Arquivo
        </Button>
        <Button variant="outline" size="md" onPress={() => void pickPhoto()}>
          Foto
        </Button>
      </View>

      {attachment && (
        <View className="gap-1">
          <View
            className="flex-row items-center gap-2 bg-surface-container rounded-card px-3 py-2.5"
            style={cardShadow}
          >
            <Ionicons
              name={ATTACHMENT_ICON[attachment.contentType] as never}
              size={18}
              color={colors.primary}
            />
            <Text
              className="flex-1 text-on-surface font-inter-medium text-sm"
              numberOfLines={1}
            >
              {attachment.name}
            </Text>
            <TouchableOpacity onPress={() => setAttachment(null)}>
              <Ionicons name="close-circle" size={18} color={colors.outline} />
            </TouchableOpacity>
          </View>
          <Text className="text-outline font-inter-regular text-xs">
            O material será gerado a partir deste anexo.
          </Text>
        </View>
      )}

      {/* Flashcards × Quiz */}
      <View className="gap-1.5">
        <Text className="text-on-surface-variant font-inter-medium text-sm">
          O que gerar
        </Text>
        <View className="bg-surface-container-high rounded-card p-1 flex-row">
          {(
            [
              ['flashcards', 'albums', 'Flashcards'],
              ['quiz', 'help-circle', 'Quiz'],
            ] as const
          ).map(([value, icon, label]) => {
            const active = genMode === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setGenMode(value)}
                className={`flex-1 py-2.5 rounded-button items-center flex-row justify-center gap-1.5 ${
                  active ? 'bg-primary-container' : ''
                }`}
              >
                <Ionicons
                  name={icon}
                  size={15}
                  color={active ? colors.onPrimaryContainer : colors.outline}
                />
                <Text
                  className={`font-inter-semibold text-sm ${
                    active ? 'text-on-primary-container' : 'text-outline'
                  }`}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text className="text-outline font-inter-regular text-xs leading-4">
          {genMode === 'quiz'
            ? 'Cada pergunta vem com 4 alternativas — também funciona como flashcard.'
            : 'Frente e verso clássicos, sem alternativas de quiz.'}
        </Text>
      </View>

      <Button
        variant="primary"
        size="lg"
        onPress={() => void handleGenerate()}
        loading={generating}
      >
        {generating
          ? 'Gerando...'
          : genMode === 'quiz'
            ? 'Gerar quiz'
            : 'Gerar flashcards'}
      </Button>
    </View>
  );
}
