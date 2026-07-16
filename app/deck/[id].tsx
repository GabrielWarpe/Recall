import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import type { Deck, Flashcard, StudySession } from '@/types';
import { db } from '@/services/database';
import { exportDeck, exportCards, BackupError } from '@/services/backup';
import { canExport } from '@/utils/community';
import { getDueCards } from '@/services/ai';
import { sessionAccuracy, STUDY_MODE_LABEL, STUDY_MODE_ICON } from '@/utils/stats';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { DeckAvatar } from '@/components/DeckAvatar';
import {
  StudyModePicker,
  useStudyModePicker,
} from '@/components/StudyModePicker';
import { useThemeColors } from '@/hooks/useThemeColors';

type Tab = 'cards' | 'history';

function accuracyColor(pct: number): string {
  return pct >= 80 ? 'text-primary' : pct >= 50 ? 'text-tertiary' : 'text-error';
}

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const picker = useStudyModePicker();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [attempts, setAttempts] = useState<StudySession[]>([]);
  const [tab, setTab] = useState<Tab>('cards');
  // Modo de seleção de cartões (para exportar só alguns).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const accuracies = attempts.map(sessionAccuracy);
  const best = accuracies.length > 0 ? Math.max(...accuracies) : null;
  const last = accuracies.length > 0 ? accuracies[0]! : null;
  // Só cards de fato vencidos — cards novos não são "revisão pendente".
  const dueCount = getDueCards(deck).length;

  const exportable = canExport(deck);

  const handleMenu = () => {
    const options: Parameters<typeof Alert.alert>[2] = [
      { text: 'Editar deck', onPress: () => router.push(`/deck/edit?id=${deck.id}`) },
    ];
    // Exportação só quando permitido (cópia baixada pode ter export bloqueado).
    if (exportable) {
      options.push({ text: 'Exportar deck', onPress: () => void handleExport() });
      if (deck.cards.length > 0) {
        options.push({ text: 'Exportar cartões…', onPress: enterSelect });
      }
    }
    options.push(
      { text: 'Excluir deck', style: 'destructive', onPress: handleDelete },
      { text: 'Cancelar', style: 'cancel' },
    );
    Alert.alert(deck.title, undefined, options);
  };

  // ── Seleção de cartões para exportar ─────────────────────────────────────
  const enterSelect = () => {
    setTab('cards');
    setSelected(new Set());
    setSelectMode(true);
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (cardId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const exportSelected = async () => {
    const chosen = deck.cards.filter(c => selected.has(c.id));
    if (chosen.length === 0) return;
    try {
      await exportCards(deck, chosen);
      exitSelect();
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar os cartões.');
    }
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
      {/* Atribuição: deck baixado da comunidade */}
      {deck.origin != null && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            router.push(`/community/${deck.origin!.communityDeckId}` as never)
          }
          className="flex-row items-center gap-1.5 mb-4"
        >
          <Ionicons name="download-outline" size={14} color={colors.outline} />
          <Text className="text-outline font-inter-medium text-xs">
            Baixado da comunidade · por {deck.origin.authorName ?? 'Anônimo'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Descrição do deck */}
      {deck.description.length > 0 && (
        <Text className="text-on-surface-variant font-inter-regular text-sm leading-5 mb-4">
          {deck.description}
        </Text>
      )}

      {/* Tags */}
      {deck.tags.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {deck.tags.map(tag => (
            <View
              key={tag}
              className="bg-surface-container-high rounded-pill px-2.5 py-1"
            >
              <Text className="text-on-surface-variant font-inter-medium text-xs">
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
          <Ionicons name="refresh" size={15} color={colors.primary} />
          <Text className="text-on-surface-variant font-inter-medium text-sm">
            <Text className="text-primary font-inter-semibold">{dueCount}</Text>{' '}
            {dueCount === 1 ? 'card' : 'cards'} para revisar hoje
          </Text>
        </View>
      )}

      {/* Study button — entrada única dos modos: abre o seletor quando o
          deck suporta quiz; senão vai direto para os flashcards. */}
      <Button
        variant="primary"
        size="lg"
        className="mb-5"
        disabled={deck.cards.length === 0}
        onPress={() => picker.requestPlay(deck)}
      >
        {attempts.length > 0 ? 'Estudar novamente' : 'Estudar deck'}
      </Button>

      {/* Segmented control */}
      <View className="bg-surface-container-high rounded-card p-1 flex-row mb-4">
        {(['cards', 'history'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-button items-center ${
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
          <View className="bg-surface-container rounded-card p-6 items-center" style={cardShadow}>
            <View
              className="w-14 h-14 rounded-card items-center justify-center mb-3"
              style={{ backgroundColor: colors.primary + '22' }}
            >
              <Ionicons name="trending-up" size={24} color={colors.primary} />
            </View>
            <Text className="text-on-surface-variant font-inter-regular text-sm text-center">
              Você ainda não estudou este deck.{'\n'}As tentativas aparecerão
              aqui.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {attempts.map((a, i) => {
              const pct = sessionAccuracy(a);
              const mode = a.mode ?? 'flash';
              return (
                <View
                  key={a.id}
                  className="bg-surface-container rounded-card px-4 py-3 flex-row items-center"
                  style={cardShadow}
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
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons
                        name={STUDY_MODE_ICON[mode]}
                        size={11}
                        color={colors.outline}
                      />
                      <Text className="text-outline font-inter-regular text-xs">
                        {STUDY_MODE_LABEL[mode]} ·{' '}
                        {format(new Date(a.date), "d MMM 'às' HH:mm")}
                      </Text>
                    </View>
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
      {/* Header bar (normal x seleção) */}
      {selectMode ? (
        <View className="flex-row items-center px-4 pt-2 pb-3">
          <TouchableOpacity onPress={exitSelect} className="p-2">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text className="flex-1 mx-2 text-on-surface font-jakarta-bold text-lg">
            {selected.size} selecionado{selected.size === 1 ? '' : 's'}
          </Text>
          <TouchableOpacity
            onPress={() => void exportSelected()}
            disabled={selected.size === 0}
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-button"
            style={{ opacity: selected.size === 0 ? 0.4 : 1 }}
          >
            <Ionicons name="share-outline" size={18} color={colors.primary} />
            <Text className="text-primary font-inter-semibold text-sm">
              Exportar
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="flex-row items-center px-4 pt-2 pb-3">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View className="flex-1 mx-2">
            <View className="flex-row items-center gap-2.5">
              <DeckAvatar coverUrl={deck.coverUrl} size={32} radius={9} />
              <Text
                className="text-on-surface font-jakarta-bold text-xl flex-1"
                numberOfLines={1}
              >
                {deck.title}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleMenu} className="p-2">
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color={colors.onSurface}
            />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={cardData}
        keyExtractor={c => c.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
        // Em modo seleção some o cabeçalho (stats/abas/estudar) para focar nos cards.
        ListHeaderComponent={selectMode ? undefined : Header}
        ListEmptyComponent={
          tab === 'cards' ? (
            <View className="items-center py-6">
              <Text className="text-outline font-inter-regular text-sm">
                Nenhum card ainda. Toque em "Adicionar cards".
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                selectMode
                  ? toggleSelect(item.id)
                  : router.push(`/deck/card?deckId=${deck.id}&cardId=${item.id}`)
              }
              className="bg-surface-container rounded-card p-4 flex-row items-start gap-2.5"
              style={[
                cardShadow,
                selectMode && isSelected
                  ? { borderWidth: 1, borderColor: colors.primary }
                  : null,
              ]}
            >
              {selectMode ? (
                <View
                  className="w-5 h-5 rounded-full items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                    borderWidth: isSelected ? 0 : 1.5,
                    borderColor: colors.outline,
                  }}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
                  )}
                </View>
              ) : (
                <Text className="text-outline font-inter-regular text-xs mt-0.5 w-5">
                  {index + 1}.
                </Text>
              )}
              <View className="flex-1">
                <Text className="text-on-surface font-inter-medium text-sm leading-5">
                  {item.front}
                </Text>
                <Text className="text-outline font-inter-regular text-xs mt-1.5 leading-4">
                  {item.back}
                </Text>
                {item.images.length > 0 && (
                  <View className="flex-row items-center gap-1 mt-1.5">
                    <Ionicons name="image" size={12} color={colors.outline} />
                    <Text className="text-outline font-inter-regular text-xs">
                      {item.images.length}{' '}
                      {item.images.length === 1 ? 'imagem' : 'imagens'}
                    </Text>
                  </View>
                )}
              </View>
              {!selectMode && (
                <Ionicons name="pencil" size={15} color={colors.outline} />
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Seletor de modo de estudo (play) */}
      <StudyModePicker deck={picker.pickerDeck} onClose={picker.close} />
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
    <View className="flex-1 bg-surface-container rounded-card p-3 items-center" style={cardShadow}>
      <Text className={`font-jakarta-bold text-lg ${valueColor}`}>{value}</Text>
      <Text className="text-outline font-inter-regular text-xs mt-0.5">
        {label}
      </Text>
    </View>
  );
}
