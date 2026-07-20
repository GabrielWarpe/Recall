import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listCommunityDecks } from '@/services/community';
import type { CommunityDeckRow } from '@/types/db';
import { DeckAvatar } from '@/components/DeckAvatar';
import { StarRating } from '@/components/StarRating';
import { Input } from '@/components/ui/Input';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TAB_SCREEN_BOTTOM_INSET } from '@/constants/layout';

const TRENDING_CARD_WIDTH = 168;
/** Quantas tags viram chip — mais que isso e a rolagem horizontal vira ruído. */
const MAX_CATEGORY_CHIPS = 8;

export default function CommunityScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [decks, setDecks] = useState<CommunityDeckRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 'top' (nota, depois downloads) já serve de base pras duas seções: "Em
  // alta" reordena por downloads no cliente, "Mais bem avaliados" usa a
  // própria ordem do servidor.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDecks(await listCommunityDecks({ search, sort: 'top' }));
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Recarrega ao focar (ex.: voltar de baixar/avaliar).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Busca com pequeno debounce para não consultar a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  // Categorias: derivadas das tags REAIS dos decks carregados (não existe
  // coluna de categoria no banco) — as mais frequentes primeiro, "Todos" na
  // frente. Chips substituem a ordenação manual como filtro primário.
  const categories = useMemo(() => {
    const freq = new Map<string, number>();
    for (const d of decks) {
      for (const tag of d.tags) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, MAX_CATEGORY_CHIPS);
  }, [decks]);
  // Se a categoria ativa saiu da lista (nova busca mudou os decks), volta a
  // "Todos" em vez de filtrar por algo que não existe mais.
  const effectiveCategory =
    category !== null && categories.includes(category) ? category : null;

  const filtered =
    effectiveCategory === null
      ? decks
      : decks.filter(d =>
          d.tags.some(t => t.toLowerCase() === effectiveCategory.toLowerCase()),
        );

  const trending = [...filtered]
    .sort((a, b) => b.downloads_count - a.downloads_count)
    .slice(0, 10);
  const topRated = filtered.filter(d => d.rating_count > 0);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      {loading && decks.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        // Página inteira num só ScrollView: cabeçalho, busca e chips rolam
        // JUNTO com o conteúdo (não ficam fixos), então nada de "tela cortada
        // em duas" — ao descer, os chips somem naturalmente.
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: TAB_SCREEN_BOTTOM_INSET }}
        >
          {/* Header */}
          <View className="px-5 pt-6 pb-3">
            <Text
              className="text-on-surface font-jakarta-extrabold text-3xl"
              style={{ letterSpacing: -0.5 }}
            >
              Comunidade
            </Text>
          </View>

          {/* Busca */}
          <View className="px-5">
            <Input
              placeholder="Buscar concurso, matéria, tema..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Categorias — filtro primário. Os chips ficam num <View flex-row>
              INTERNO (não como filhos diretos do contentContainer): um
              ScrollView horizontal estica os filhos diretos na vertical, o que
              virava cápsulas altas ao selecionar. */}
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3"
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => setCategory(null)}
                  activeOpacity={0.8}
                  className={`px-3.5 py-1.5 rounded-pill ${
                    effectiveCategory === null
                      ? 'bg-primary-container'
                      : 'bg-surface-container'
                  }`}
                >
                  <Text
                    className={`font-inter-semibold text-xs ${
                      effectiveCategory === null
                        ? 'text-on-primary-container'
                        : 'text-outline'
                    }`}
                  >
                    Todos
                  </Text>
                </TouchableOpacity>
                {categories.map(tag => {
                  const active = effectiveCategory === tag;
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setCategory(active ? null : tag)}
                      activeOpacity={0.8}
                      className={`px-3.5 py-1.5 rounded-pill ${
                        active ? 'bg-primary-container' : 'bg-surface-container'
                      }`}
                    >
                      <Text
                        className={`font-inter-semibold text-xs ${
                          active ? 'text-on-primary-container' : 'text-outline'
                        }`}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {filtered.length === 0 ? (
            <View className="items-center justify-center px-8 pt-24">
              <View
                className="w-16 h-16 rounded-card items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary + '22' }}
              >
                <Ionicons name="earth" size={28} color={colors.primary} />
              </View>
              <Text className="text-on-surface font-jakarta-bold text-lg text-center">
                {search || effectiveCategory ? 'Nada encontrado' : 'Ainda não há decks públicos'}
              </Text>
              <Text className="text-outline font-inter-regular text-sm text-center mt-2">
                {search || effectiveCategory
                  ? 'Tente outra busca ou categoria.'
                  : 'Seja o primeiro: publique um deck na edição dele.'}
              </Text>
            </View>
          ) : (
            <>
          {/* Em alta esta semana — vitrine com capas grandes. Sem dado de
              popularidade por janela de tempo no banco: usa downloads
              acumulados como aproximação (é o sinal de "alta" que existe). */}
          {trending.length > 0 && (
            <View className="mt-5">
              <View className="flex-row items-center gap-1.5 px-5 mb-3">
                <Text className="text-on-surface font-jakarta-bold text-lg">
                  Em alta esta semana
                </Text>
                <Ionicons name="flame" size={16} color={colors.tertiary} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              >
                {trending.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/community/${item.id}` as Href)}
                    style={{ width: TRENDING_CARD_WIDTH }}
                  >
                    <DeckAvatar
                      coverUrl={item.cover_url}
                      size={TRENDING_CARD_WIDTH}
                      radius={16}
                    />
                    <Text
                      className="text-on-surface font-jakarta-bold text-sm mt-2 leading-5"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <View className="flex-row items-center gap-1.5 mt-1">
                      <StarRating value={item.rating_avg} size={12} />
                      <Text className="text-outline font-inter-medium text-xs">
                        {item.rating_avg.toFixed(1)}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons
                        name="download-outline"
                        size={12}
                        color={colors.outline}
                      />
                      <Text className="text-outline font-inter-medium text-xs">
                        {item.downloads_count}
                      </Text>
                      <Text className="text-outline font-inter-regular text-xs">
                        · {item.card_count} cards
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Mais bem avaliados — lista densa, sem competir por espaço com as
              capas grandes da vitrine acima. */}
          {topRated.length > 0 && (
            <View className="mt-6 px-5">
              <Text className="text-on-surface font-jakarta-bold text-lg mb-3">
                Mais bem avaliados
              </Text>
              <View className="gap-3">
                {topRated.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/community/${item.id}` as Href)}
                    className="bg-surface-container rounded-card p-3 flex-row items-center gap-3"
                    style={cardShadow}
                  >
                    <DeckAvatar coverUrl={item.cover_url} size={48} radius={12} />
                    <View className="flex-1">
                      <Text
                        className="text-on-surface font-jakarta-bold text-sm"
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {item.author_name != null && (
                        <Text
                          className="text-outline font-inter-regular text-xs mt-0.5"
                          numberOfLines={1}
                        >
                          por {item.author_name}
                        </Text>
                      )}
                    </View>
                    <View className="items-end">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="star" size={12} color={colors.tertiary} />
                        <Text className="text-on-surface font-inter-semibold text-xs">
                          {item.rating_avg.toFixed(1)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Ionicons
                          name="download-outline"
                          size={11}
                          color={colors.outline}
                        />
                        <Text className="text-outline font-inter-medium text-xs">
                          {item.downloads_count}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
