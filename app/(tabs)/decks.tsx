import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDecks } from '@/hooks/useDecks';
import { DeckCard } from '@/components/DeckCard';
import { Input } from '@/components/ui/Input';

export default function DecksScreen() {
  const router = useRouter();
  const { decks } = useDecks();
  const [search, setSearch] = useState('');

  const filtered = decks.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-on-surface font-jakarta-extrabold text-2xl mb-4">
          Decks
        </Text>
        <Input
          placeholder="Buscar decks..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
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
