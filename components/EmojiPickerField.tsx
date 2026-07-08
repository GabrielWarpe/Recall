import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { emojisByCategory } from 'rn-emoji-keyboard';
import { useThemeColors } from '@/hooks/useThemeColors';

interface EmojiPickerFieldProps {
  value: string;
  onChange: (emoji: string) => void;
}

type EmojiEntry = { emoji: string; name: string; keywords?: string[] };

const CATEGORY_LABELS: Record<string, string> = {
  smileys_emotion: 'Rostos e emoções',
  people_body: 'Pessoas',
  animals_nature: 'Animais e natureza',
  food_drink: 'Comida e bebida',
  travel_places: 'Viagem e lugares',
  activities: 'Atividades',
  objects: 'Objetos',
  symbols: 'Símbolos',
  flags: 'Bandeiras',
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  smileys_emotion: 'happy-outline',
  people_body: 'people-outline',
  animals_nature: 'leaf-outline',
  food_drink: 'fast-food-outline',
  travel_places: 'airplane-outline',
  activities: 'football-outline',
  objects: 'bulb-outline',
  symbols: 'shapes-outline',
  flags: 'flag-outline',
};

const CELL_SIZE = 44;
const SHEET_HORIZONTAL_PADDING = 16;

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

/** Botão com o emoji atual do deck; toque abre o seletor completo (todas as
 * categorias + busca), temático com as cores ativas do app. Usa só os dados
 * brutos da lib `rn-emoji-keyboard` (`emojisByCategory`); a UI é própria (a
 * navegação da lib travava sob a New Architecture do RN). As abas FILTRAM por
 * categoria — trocam o conteúdo mostrado, sem depender de scroll programático. */
export function EmojiPickerField({ value, onChange }: EmojiPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(0);
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  const columns = Math.max(
    4,
    Math.floor((width - SHEET_HORIZONTAL_PADDING * 2) / CELL_SIZE),
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const all = emojisByCategory.flatMap(c => c.data as EmojiEntry[]);
    return all.filter(
      e =>
        e.name.toLowerCase().includes(q) ||
        e.keywords?.some(k => k.toLowerCase().includes(q)),
    );
  }, [search]);

  // Emojis mostrados agora: resultado da busca OU a categoria ativa.
  const visibleEmojis: EmojiEntry[] = searchResults
    ? searchResults
    : ((emojisByCategory[activeCat]?.data as EmojiEntry[]) ?? []);

  const rows = useMemo(() => chunk(visibleEmojis, columns), [visibleEmojis, columns]);

  const select = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className="w-14 h-14 rounded-xl items-center justify-center bg-surface-container-high border border-primary"
      >
        <Text className="text-2xl">{value}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setOpen(false)}
        >
          <Pressable
            className="bg-surface-container rounded-t-3xl overflow-hidden"
            style={{ height: '75%' }}
            onPress={e => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-outline-variant/30">
              <Text className="text-on-surface font-jakarta-semibold text-base">
                Escolha um ícone
              </Text>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-high items-center justify-center"
                hitSlop={10}
              >
                <Ionicons name="close" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View className="px-4 pt-3 pb-2">
              <View className="flex-row items-center gap-2 bg-surface-container-high rounded-xl px-3 h-11">
                <Ionicons name="search" size={16} color={colors.onSurfaceVariant} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar emoji..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  className="flex-1 text-on-surface"
                  style={{ color: colors.onSurface }}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Abas de categoria: filtram o conteúdo (desabilitadas na busca) */}
            <View className="flex-row flex-wrap px-3 pb-2 gap-1">
              {emojisByCategory.map((c, i) => {
                const active = !searchResults && i === activeCat;
                return (
                  <TouchableOpacity
                    key={c.title}
                    onPress={() => {
                      setSearch('');
                      setActiveCat(i);
                    }}
                    className={`w-9 h-9 rounded-lg items-center justify-center ${
                      active ? 'bg-primary/20 border border-primary' : 'bg-surface-container-high'
                    }`}
                  >
                    <Ionicons
                      name={CATEGORY_ICONS[c.title] ?? 'ellipse-outline'}
                      size={16}
                      color={active ? colors.primary : colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Rótulo do que está sendo mostrado */}
            <View className="px-4 pb-1">
              <Text className="text-on-surface-variant font-inter-medium text-xs">
                {searchResults
                  ? `${searchResults.length} resultado${searchResults.length === 1 ? '' : 's'}`
                  : (CATEGORY_LABELS[emojisByCategory[activeCat]?.title ?? ''] ?? '')}
              </Text>
            </View>

            {searchResults && searchResults.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-on-surface-variant font-inter-medium">
                  Nenhum emoji encontrado
                </Text>
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(_, i) => `${activeCat}:${search}:${i}`}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingHorizontal: SHEET_HORIZONTAL_PADDING,
                  paddingBottom: 24,
                }}
                renderItem={({ item }) => (
                  <View className="flex-row" style={{ height: CELL_SIZE }}>
                    {item.map(e => (
                      <TouchableOpacity
                        key={e.emoji}
                        onPress={() => select(e.emoji)}
                        style={{ width: CELL_SIZE, height: CELL_SIZE }}
                        className="items-center justify-center"
                      >
                        <Text className="text-2xl">{e.emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
