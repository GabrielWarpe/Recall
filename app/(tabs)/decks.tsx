import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { exportDecks, importDecks, BackupError } from '@/services/backup';
import { errorMessage } from '@/utils/errors';
import { DeckCard } from '@/components/DeckCard';
import { Input } from '@/components/ui/Input';
import { cardShadow } from '@/components/ui/Card';

export default function DecksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { decks, reload } = useDecks();
  const colors = useThemeColors();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<'recent' | 'alpha' | 'count'>('recent');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Todas as tags em uso, para a linha de filtro. Se a tag ativa deixou de
  // existir (deck editado/excluído), o filtro volta para "Todas".
  const allTags = [...new Set(decks.flatMap(d => d.tags))].sort((a, b) =>
    a.localeCompare(b, 'pt'),
  );
  const effectiveTag =
    activeTag !== null && allTags.includes(activeTag) ? activeTag : null;

  const filtered = decks.filter(
    d =>
      d.title.toLowerCase().includes(search.toLowerCase()) &&
      (effectiveTag === null || d.tags.includes(effectiveTag)),
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'alpha') return a.title.localeCompare(b.title, 'pt');
    if (sort === 'count') return b.cards.length - a.cards.length;
    // 'recent': último estudo (ou criação) mais recente primeiro.
    const at = new Date(a.lastStudied ?? a.createdAt).getTime();
    const bt = new Date(b.lastStudied ?? b.createdAt).getTime();
    return bt - at;
  });

  const SORTS: { key: typeof sort; label: string }[] = [
    { key: 'recent', label: 'Recentes' },
    { key: 'alpha', label: 'A–Z' },
    { key: 'count', label: 'Mais cards' },
  ];

  const handleExport = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const { deckCount, cardCount } = await exportDecks(user.id);
      // Sem alerta de sucesso: a folha de compartilhamento do sistema já
      // confirma visualmente. Mantido só o caso "nada para exportar".
      void deckCount;
      void cardCount;
    } catch (e) {
      if (e instanceof BackupError && e.code === 'EMPTY') {
        Alert.alert('Nada para exportar', 'Crie um baralho antes de exportar.');
      } else {
        Alert.alert('Erro', 'Não foi possível exportar os baralhos.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = await importDecks(user.id);
      if (!result) return; // cancelado
      await reload();
      Alert.alert(
        'Importação concluída',
        `${result.deckCount} baralho(s) e ${result.cardCount} cartão(ões) importados.`,
      );
    } catch (e) {
      let msg: string;
      if (e instanceof BackupError) {
        msg =
          e.code === 'INVALID'
            ? 'O arquivo selecionado não é um backup válido do Recall.'
            : e.code === 'READ'
              ? 'Não consegui ler o arquivo. Salve-o no app Arquivos e tente importar de lá.'
              : 'Nenhum baralho válido foi encontrado no arquivo.';
      } else {
        // Erro inesperado (ex.: banco/rede): mostra o detalhe para diagnóstico.
        const detail = errorMessage(e, String(e));
        msg = `Não foi possível importar os baralhos.\n\nDetalhe: ${detail}`;
      }
      Alert.alert('Erro na importação', msg);
    } finally {
      setBusy(false);
    }
  };

  const confirmBackup = () => {
    Alert.alert('Baralhos', 'O que você quer fazer?', [
      { text: 'Exportar todos', onPress: () => void handleExport() },
      { text: 'Importar de arquivo', onPress: () => void handleImport() },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-6 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className="text-on-surface font-jakarta-extrabold text-3xl"
            style={{ letterSpacing: -0.5 }}
          >
            Decks
          </Text>
          <TouchableOpacity
            onPress={confirmBackup}
            disabled={busy}
            activeOpacity={0.8}
            className="w-10 h-10 items-center justify-center rounded-button bg-surface-container"
            style={{ opacity: busy ? 0.5 : 1, ...cardShadow }}
          >
            <Ionicons
              name="swap-vertical"
              size={20}
              color={colors.onSurface}
            />
          </TouchableOpacity>
        </View>
        <Input
          placeholder="Buscar decks..."
          value={search}
          onChangeText={setSearch}
        />
        {decks.length > 1 && (
          <View className="flex-row gap-2 mt-3">
            {SORTS.map(s => {
              const active = sort === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSort(s.key)}
                  activeOpacity={0.8}
                  className={`px-3.5 py-1.5 rounded-pill ${
                    active
                      ? 'bg-primary-container'
                      : 'bg-surface-container-high'
                  }`}
                >
                  <Text
                    className={`font-inter-medium text-xs ${
                      active
                        ? 'text-on-primary-container'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Filtro por tag */}
        {allTags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
          >
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setActiveTag(null)}
                activeOpacity={0.8}
                className={`px-3.5 py-1.5 rounded-pill ${
                  effectiveTag === null
                    ? 'bg-primary-container'
                    : 'bg-surface-container-high'
                }`}
              >
                <Text
                  className={`font-inter-medium text-xs ${
                    effectiveTag === null
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant'
                  }`}
                >
                  Todas
                </Text>
              </TouchableOpacity>
              {allTags.map(tag => {
                const active = effectiveTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setActiveTag(active ? null : tag)}
                    activeOpacity={0.8}
                    className={`px-3.5 py-1.5 rounded-pill ${
                      active
                        ? 'bg-primary-container'
                        : 'bg-surface-container-high'
                    }`}
                  >
                    <Text
                      className={`font-inter-medium text-xs ${
                        active
                          ? 'text-on-primary-container'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      #{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={d => d.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center mt-16 px-6">
            <View
              className="w-16 h-16 rounded-card items-center justify-center mb-4"
              style={{ backgroundColor: colors.primary + '22' }}
            >
              <Ionicons
                name={search.length > 0 ? 'search' : 'albums'}
                size={26}
                color={colors.primary}
              />
            </View>
            <Text className="text-on-surface font-jakarta-bold text-lg text-center">
              {search.length > 0
                ? 'Nenhum deck encontrado'
                : 'Nenhum deck ainda'}
            </Text>
            <Text className="text-on-surface-variant font-inter-regular text-sm mt-2 text-center">
              {search.length > 0
                ? 'Tente outra busca'
                : 'Toque em + para criar seu primeiro deck'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DeckCard
            deck={item}
            onPress={() => router.push(`/deck/${item.id}`)}
            onStudy={() => router.push(`/study/${item.id}`)}
            onQuiz={() => router.push(`/quiz/${item.id}`)}
            onWrite={() => router.push(`/write/${item.id}`)}
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-5 w-14 h-14 bg-primary-container rounded-full items-center justify-center"
        onPress={() => router.push('/deck/create')}
        style={{
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#dffbf7" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
