import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getCommunityDeck,
  listReviews,
  hasDownloaded,
  hasLocalCopy,
  getMyRating,
  downloadDeck,
  rateDeck,
  reportDeck,
} from '@/services/community';
import type {
  CommunityDeckRow,
  CommunityCardRow,
  DeckRatingRow,
  ReportReason,
} from '@/types/db';
import { isDerived } from '@/utils/community';
import { useAuth } from '@/contexts/AuthContext';
import { StarRating } from '@/components/StarRating';
import { Button } from '@/components/ui/Button';
import { Card, cardShadow } from '@/components/ui/Card';
import { errorMessage } from '@/utils/errors';
import { useThemeColors } from '@/hooks/useThemeColors';

const PREVIEW_LIMIT = 5;

/** Avatar pequeno de autor/avaliador (foto ou inicial). */
function MiniAvatar({
  url,
  name,
  size = 28,
}: {
  url: string | null;
  name: string | null;
  size?: number;
}) {
  const colors = useThemeColors();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryContainer,
      }}
      className="items-center justify-center"
    >
      <Text
        className="text-on-primary-container font-jakarta-bold"
        style={{ fontSize: size * 0.45 }}
      >
        {(name?.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export default function CommunityDeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { user, profile } = useAuth();

  const [deck, setDeck] = useState<CommunityDeckRow | null>(null);
  const [cards, setCards] = useState<CommunityCardRow[]>([]);
  const [reviews, setReviews] = useState<DeckRatingRow[]>([]);
  // Dois conceitos distintos: ter uma cópia AGORA (controla o botão Baixar —
  // excluiu a cópia? pode baixar de novo) × já ter baixado ALGUM DIA
  // (registro permanente; é o que libera avaliar).
  const [hasCopy, setHasCopy] = useState(false);
  const [canRate, setCanRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rascunho da avaliação do usuário.
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    if (!id || !user) return;
    const full = await getCommunityDeck(id);
    if (full) {
      setDeck(full.deck);
      setCards(full.cards);
    }
    const [revs, copy, dl, mine] = await Promise.all([
      listReviews(id),
      hasLocalCopy(id, user.id),
      hasDownloaded(id, user.id),
      getMyRating(id, user.id),
    ]);
    setReviews(revs);
    setHasCopy(copy);
    setCanRate(dl);
    if (mine) {
      setStars(mine.stars);
      setComment(mine.comment ?? '');
    }
    setLoading(false);
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDownload = async () => {
    if (!id || !user || downloading) return;
    setDownloading(true);
    try {
      await downloadDeck(user.id, id);
      setHasCopy(true);
      setCanRate(true);
      await load();
      Alert.alert(
        'Deck baixado!',
        'Uma cópia foi adicionada aos seus decks. Agora você pode estudá-la e avaliá-la.',
      );
    } catch (e) {
      Alert.alert('Erro', errorMessage(e, 'Não foi possível baixar o deck.'));
    } finally {
      setDownloading(false);
    }
  };

  const handleReport = () => {
    if (!id || !user) return;
    const send = (reason: ReportReason) =>
      void reportDeck({ communityDeckId: id, userId: user.id, reason })
        .then(() =>
          Alert.alert('Denúncia enviada', 'Obrigado. Vamos analisar este deck.'),
        )
        .catch(e =>
          Alert.alert('Erro', errorMessage(e, 'Não foi possível denunciar.')),
        );
    Alert.alert('Denunciar deck', 'Qual o motivo?', [
      { text: 'Plágio / conteúdo roubado', onPress: () => send('plagiarism') },
      { text: 'Conteúdo impróprio', onPress: () => send('inappropriate') },
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleSubmitRating = async () => {
    if (!id || !user || stars < 1 || submitting) return;
    setSubmitting(true);
    try {
      await rateDeck({
        communityDeckId: id,
        userId: user.id,
        stars,
        comment: comment.trim() || null,
        reviewer: {
          name: profile?.name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        },
      });
      await load();
      Alert.alert('Obrigado!', 'Sua avaliação foi registrada.');
    } catch (e) {
      Alert.alert('Erro', errorMessage(e, 'Não foi possível avaliar.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !deck) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-2">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text className="flex-1 text-on-surface font-jakarta-bold text-base ml-1" numberOfLines={1}>
          Deck da comunidade
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Capa + título */}
        {deck.cover_url ? (
          <Image
            source={{ uri: deck.cover_url }}
            style={{ width: '100%', height: 160, borderRadius: 16 }}
            resizeMode="cover"
          />
        ) : null}

        <View>
          <Text className="text-on-surface font-jakarta-extrabold text-2xl">
            {deck.title}
          </Text>
          {deck.description ? (
            <Text className="text-on-surface-variant font-inter-regular text-sm mt-2 leading-5">
              {deck.description}
            </Text>
          ) : null}
        </View>

        {/* Autor + métricas */}
        <View className="flex-row items-center gap-2">
          <MiniAvatar url={deck.author_avatar_url} name={deck.author_name} />
          <View className="flex-1">
            <Text className="text-on-surface-variant font-inter-medium text-sm" numberOfLines={1}>
              {deck.author_name ?? 'Anônimo'}
            </Text>
            {isDerived(deck) && (
              <Text className="text-outline font-inter-regular text-xs" numberOfLines={1}>
                Adaptado de {deck.original_author_name ?? 'outro autor'}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={handleReport} hitSlop={8} className="p-1">
            <Ionicons name="flag-outline" size={18} color={colors.outline} />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1.5">
            <StarRating value={deck.rating_avg} size={16} />
            <Text className="text-outline font-inter-medium text-sm">
              {deck.rating_count > 0
                ? `${deck.rating_avg.toFixed(1)} (${deck.rating_count})`
                : 'sem notas'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="download-outline" size={15} color={colors.outline} />
            <Text className="text-outline font-inter-medium text-sm">
              {deck.downloads_count}
            </Text>
          </View>
          <Text className="text-outline font-inter-regular text-sm">
            {deck.card_count} cards
          </Text>
        </View>

        {/* Baixar — o selo só aparece enquanto a cópia EXISTE nos seus decks;
            excluiu a cópia? o botão volta e dá para baixar de novo. */}
        {hasCopy ? (
          <View className="flex-row items-center justify-center gap-2 py-3 rounded-card bg-surface-container" style={cardShadow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text className="text-on-surface font-inter-semibold text-sm">
              Já está nos seus decks
            </Text>
          </View>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onPress={() => void handleDownload()}
            loading={downloading}
          >
            {downloading
              ? 'Baixando...'
              : canRate
                ? 'Baixar de novo'
                : 'Baixar deck'}
          </Button>
        )}

        {/* Prévia dos cards */}
        <View className="gap-2">
          <Text className="text-on-surface font-jakarta-bold text-base">
            Prévia
          </Text>
          {cards.slice(0, PREVIEW_LIMIT).map(c => (
            <Card key={c.id} className="p-4">
              <Text className="text-on-surface font-inter-semibold text-sm leading-5">
                {c.front}
              </Text>
              <Text className="text-outline font-inter-regular text-xs mt-1.5 leading-4">
                {c.back}
              </Text>
            </Card>
          ))}
          {cards.length > PREVIEW_LIMIT && (
            <Text className="text-outline font-inter-regular text-xs text-center mt-1">
              + {cards.length - PREVIEW_LIMIT} cards ao baixar
            </Text>
          )}
        </View>

        {/* Sua avaliação — quem já baixou ALGUM DIA pode avaliar, mesmo que
            tenha excluído a cópia (usou o deck, a opinião vale). */}
        {canRate && (
          <View className="gap-3 bg-surface-container rounded-card p-4" style={cardShadow}>
            <Text className="text-on-surface font-jakarta-bold text-base">
              Sua avaliação
            </Text>
            <StarRating value={stars} size={30} onChange={setStars} />
            <TextInput
              placeholder="Escreva um comentário (opcional)"
              placeholderTextColor={colors.outline}
              value={comment}
              onChangeText={setComment}
              multiline
              className="bg-surface-container-high rounded-button px-4 py-3 text-on-surface font-inter-regular text-sm border border-outline-variant"
              style={{ minHeight: 64, textAlignVertical: 'top' }}
            />
            <Button
              variant="primary"
              size="md"
              onPress={() => void handleSubmitRating()}
              loading={submitting}
              disabled={stars < 1}
            >
              {submitting ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </View>
        )}

        {/* Avaliações da comunidade */}
        <View className="gap-3">
          <Text className="text-on-surface font-jakarta-bold text-base">
            Avaliações {reviews.length > 0 ? `(${reviews.length})` : ''}
          </Text>
          {reviews.length === 0 ? (
            <Text className="text-outline font-inter-regular text-sm">
              Ainda sem avaliações. Baixe e seja o primeiro a avaliar!
            </Text>
          ) : (
            reviews.map(r => (
              <View
                key={r.id}
                className="bg-surface-container rounded-card p-4 gap-2"
                style={cardShadow}
              >
                <View className="flex-row items-center gap-2">
                  <MiniAvatar url={r.reviewer_avatar_url} name={r.reviewer_name} size={26} />
                  <Text className="text-on-surface font-inter-semibold text-sm flex-1" numberOfLines={1}>
                    {r.reviewer_name ?? 'Anônimo'}
                  </Text>
                  <Text className="text-outline font-inter-regular text-xs">
                    {formatDistanceToNow(new Date(r.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </Text>
                </View>
                <StarRating value={r.stars} size={13} />
                {r.comment ? (
                  <Text className="text-on-surface-variant font-inter-regular text-sm leading-5">
                    {r.comment}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
