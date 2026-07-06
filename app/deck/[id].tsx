import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import type { Deck, Flashcard, StudySession } from '@/types';
import { db } from '@/services/database';
import { exportDeck, BackupError } from '@/services/backup';
import { getSessionCards } from '@/services/ai';
import { useSettings } from '@/contexts/SettingsContext';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

type Tab = 'cards' | 'history';

function accuracyOf(s: StudySession): number {
  return s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
}

function accuracyColor(pct: number): string {
  return pct >= 80 ? 'text-primary' : pct >= 50 ? 'text-tertiary' : 'text-error';
}

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { settings } = useSettings();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [attempts, setAttempts] = useState<StudySession[]>([]);
  const [tab, setTab] = useState<Tab>('cards');

  const load = useCallback(async () => {
    if (!id) return;
    const d = await db.decks.getOne(id);
    setDeck(d);
    if (d) setAttempts(await db.sessions.getByDeck(id, d.title));
  }, [id]);

  // Recarrega ao ganhar foco (ex.: ao voltar de uma sessão de estudo ou edição).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!deck) return null;

  const accuracies = attempts.map(accuracyOf);
  const best = accuracies.length > 0 ? Math.max(...accuracies) : null;
  const last = accuracies.length > 0 ? accuracies[0]! : null;
  const dueCount = getSessionCards(deck, settings.newPerSession).length;

  const handleMenu = () => {
    Alert.alert(deck.title, undefined, [
      { text: 'Editar deck', onPress: () => router.push(`/deck/edit?id=${deck.id}`) },
      { text: 'Exportar deck', onPress: () => void handleExport() },
      { text: 'Excluir deck', style: 'destructive', onPress: handleDelete },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleExport = async () => {
    if (!deck) return;
    try {
      await exportDeck(deck);
    } catch (e) {
      if (e instanceof BackupError && e.code === 'EMPTY') {
        Alert.alert('Deck vazio', 'Adicione cards antes de exportar.');
      } else {
        Alert.alert('Erro', 'Não foi possível exportar o deck.');
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Excluir deck',
      `Deseja excluir "${deck.title}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await db.decks.delete(deck.id);
            router.back();
          },
        },
      ],
    );
  };

  const Header = (
    <View>
      {/* Tags */}
      {deck.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {deck.tags.map(tag => (
            <View
              key={tag}
              className="bg-surface-container-high rounded-full px-2.5 py-1"
            >
              <Text className="text-outline font-inter-medium text-xs">
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats row */}
      <View className="flex-row gap-3 mb-4">
        <StatChip label="Cards" value={String(deck.cards.length)} />
        <StatChip label="Tentativas" value={String(attempts.length)} />
        <StatChip
          label="Melhor"
          value={best != null ? `${best}%` : '—'}
          accent="primary"
        />
        <StatChip
          label="Última"
          value={last != null ? `${last}%` : '—'}
          accent="tertiary"
        />
      </View>

      {/* Revisar hoje */}
      {dueCount > 0 && (
        <View className="flex-row items-center gap-1.5 mb-3">
          <Text className="text-sm">🔄</Text>
          <Text className="text-on-surface-variant font-inter-medium text-sm">
            <Text className="text-primary font-inter-semibold">{dueCount}</Text>{' '}
            {dueCount === 1 ? 'card' : 'cards'} para revisar hoje
          </Text>
        </View>
      )}

      {/* Study button — o modo quiz fica na LISTA de decks, de propósito:
          aqui as respostas dos cards estão visíveis e estragariam o quiz. */}
      <Button
        variant="primary"
        size="lg"
        className="mb-5"
        disabled={deck.cards.length === 0}
        onPress={() => router.push(`/study/${deck.id}`)}
      >
        {attempts.length > 0 ? 'Estudar novamente' : 'Estudar deck'}
      </Button>

      {/* Segmented control */}
      <View className="bg-surface-container-high rounded-card p-1 flex-row mb-4">
        {(['cards', 'history'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              tab === t ? 'bg-primary-container' : ''
            }`}
          >
            <Text
              className={`font-inter-semibold text-sm ${
                tab === t ? 'text-on-primary-container' : 'text-outline'
              }`}
            >
              {t === 'cards'
                ? `Cards (${deck.cards.length})`
                : `Histórico (${attempts.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add cards button (only on cards tab) */}
      {tab === 'cards' && (
        <TouchableOpacity
          onPress={() => router.push(`/deck/add-cards?deckId=${deck.id}`)}
          activeOpacity={0.8}
          className="border border-dashed border-primary/50 rounded-card py-3.5 mb-3 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text className="text-primary font-inter-semibold text-sm">
            Adicionar cards
          </Text>
        </TouchableOpacity>
      )}

      {/* History list (only on history tab) */}
      {tab === 'history' &&
        (attempts.length === 0 ? (
          <View className="bg-surface-container rounded-card p-5 items-center border border-outline-variant/20">
            <Text className="text-2xl mb-1">📈</Text>
            <Text className="text-outline font-inter-regular text-sm text-center">
              Você ainda não estudou este deck.{'\n'}As tentativas aparecerão
              aqui.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {attempts.map((a, i) => {
              const pct = accuracyOf(a);
              return (
                <View
                  key={a.id}
                  className="bg-surface-container rounded-card px-4 py-3 flex-row items-center border border-outline-variant/20"
                >
                  <View className="w-8 h-8 rounded-full bg-surface-container-high items-center justify-center mr-3">
                    <Text className="text-outline font-jakarta-bold text-xs">
                      {attempts.length - i}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-on-surface font-inter-medium text-sm">
                      {a.correct}/{a.total} acertos
                    </Text>
                    <Text className="text-outline font-inter-regular text-xs mt-0.5">
                      {format(new Date(a.date), "d MMM 'às' HH:mm")}
                    </Text>
                  </View>
                  <Text
                    className={`font-jakarta-bold text-lg ${accuracyColor(pct)}`}
                  >
                    {pct}%
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
    </View>
  );

  // Os cards só são renderizados pela FlatList quando a aba "cards" está ativa.
  const cardData: Flashcard[] = tab === 'cards' ? deck.cards : [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header bar */}
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View className="flex-1 mx-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl">{deck.emoji}</Text>
            <Text
              className="text-on-surface font-jakarta-bold text-xl flex-1"
              numberOfLines={1}
            >
              {deck.title}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleMenu} className="p-2">
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.onSurface} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={cardData}
        keyExtractor={c => c.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 32,
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          tab === 'cards' ? (
            <View className="items-center py-6">
              <Text className="text-outline font-inter-regular text-sm">
                Nenhum card ainda. Toque em "Adicionar cards".
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              router.push(`/deck/card?deckId=${deck.id}&cardId=${item.id}`)
            }
            className="bg-surface-container rounded-card p-4 border border-outline-variant/20 flex-row items-start gap-2"
          >
            <Text className="text-outline font-inter-regular text-xs mt-0.5 w-5">
              {index + 1}.
            </Text>
            <View className="flex-1">
              <Text className="text-on-surface font-inter-medium text-sm leading-5">
                {item.front}
              </Text>
              <Text className="text-outline font-inter-regular text-xs mt-1.5 leading-4">
                {item.back}
              </Text>
            </View>
            <Ionicons name="pencil" size={15} color={colors.outline} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'primary' | 'tertiary';
}) {
  const valueColor =
    accent === 'primary'
      ? 'text-primary'
      : accent === 'tertiary'
        ? 'text-tertiary'
        : 'text-on-surface';

  return (
    <View className="flex-1 bg-surface-container rounded-card p-3 items-center border border-outline-variant/20">
      <Text className={`font-jakarta-bold text-lg ${valueColor}`}>{value}</Text>
      <Text className="text-outline font-inter-regular text-xs mt-0.5">
        {label}
      </Text>
    </View>
  );
}
