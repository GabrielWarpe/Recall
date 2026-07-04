import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { exportDecks, importDecks, BackupError } from '@/services/backup';
import { DeckCard } from '@/components/DeckCard';
import { Input } from '@/components/ui/Input';

export default function DecksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { decks, reload } = useDecks();
  const colors = useThemeColors();
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<'recent' | 'alpha' | 'count'>('recent');

  const filtered = decks.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()),
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
      const msg =
        e instanceof BackupError
          ? e.code === 'INVALID'
            ? 'O arquivo selecionado não é um backup válido do Recall.'
            : 'Nenhum baralho válido foi encontrado no arquivo.'
          : 'Não foi possível importar os baralhos.';
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
      <View className="px-6 pt-4 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-on-surface font-jakarta-extrabold text-2xl">
            Decks
          </Text>
          <TouchableOpacity
            onPress={confirmBackup}
            disabled={busy}
            activeOpacity={0.8}
            className="w-10 h-10 items-center justify-center rounded-xl bg-surface-container"
            style={{ opacity: busy ? 0.5 : 1 }}
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
                  className={`px-3.5 py-1.5 rounded-full ${
                    active ? 'bg-primary-container' : 'bg-surface-container'
                  }`}
                >
                  <Text
                    className={`font-inter-medium text-xs ${
                      active ? 'text-on-primary-container' : 'text-outline'
                    }`}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={d => d.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 120,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center mt-12 px-4">
            <Text className="text-4xl mb-3">
              {search.length > 0 ? '🔍' : '📚'}
            </Text>
            <Text className="text-on-surface font-jakarta-bold text-lg text-center">
              {search.length > 0
                ? 'Nenhum deck encontrado'
                : 'Nenhum deck ainda'}
            </Text>
            <Text className="text-outline font-inter-regular text-sm mt-2 text-center">
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
          />
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-primary-container rounded-full items-center justify-center"
        onPress={() => router.push('/deck/create')}
        style={{ elevation: 8 }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#ede0ff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
