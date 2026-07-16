import { supabase } from './supabase';
import { db } from './database';
import { presetFor } from '@/utils/community';
import type { Deck } from '@/types';
import type {
  CommunityDeckRow,
  CommunityCardRow,
  DeckRatingRow,
  DeckLicense,
  ReportReason,
} from '@/types/db';

/**
 * Comunidade: decks públicos no modelo SNAPSHOT. Publicar copia o deck de
 * trabalho para as tabelas `community_*` (congeladas); baixar copia de volta
 * para a conta de quem baixa, com o SM-2 zerado. As tabelas privadas
 * (playlists/flashcards) nunca são expostas.
 */

export type CommunitySort = 'top' | 'downloads' | 'recent';

/** Identidade do autor/avaliador no momento da ação (denormalizada). */
export interface PublicIdentity {
  name: string | null;
  avatarUrl: string | null;
}

// ── Catálogo ─────────────────────────────────────────────────────────────────

export async function listCommunityDecks(opts: {
  search?: string;
  sort?: CommunitySort;
}): Promise<CommunityDeckRow[]> {
  let query = supabase.from('community_decks').select('*');

  const term = opts.search?.trim();
  if (term) query = query.ilike('title', `%${term}%`);

  if (opts.sort === 'downloads') {
    query = query.order('downloads_count', { ascending: false });
  } else if (opts.sort === 'recent') {
    query = query.order('published_at', { ascending: false });
  } else {
    query = query
      .order('rating_avg', { ascending: false })
      .order('downloads_count', { ascending: false });
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data ?? []) as CommunityDeckRow[];
}

export async function getCommunityDeck(
  id: string,
): Promise<{ deck: CommunityDeckRow; cards: CommunityCardRow[] } | null> {
  const { data: deck, error } = await supabase
    .from('community_decks')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !deck) return null;

  const { data: cards } = await supabase
    .from('community_cards')
    .select('*')
    .eq('community_deck_id', id)
    .order('position', { ascending: true });

  return {
    deck: deck as CommunityDeckRow,
    cards: (cards ?? []) as CommunityCardRow[],
  };
}

// ── Publicação (snapshot) ────────────────────────────────────────────────────

/** Snapshot já publicado para um deck de trabalho (para o toggle saber o estado). */
export async function getPublishedFor(
  sourcePlaylistId: string,
): Promise<CommunityDeckRow | null> {
  const { data, error } = await supabase
    .from('community_decks')
    .select('*')
    .eq('source_playlist_id', sourcePlaylistId)
    .maybeSingle();
  if (error) return null;
  return (data as CommunityDeckRow) ?? null;
}

/**
 * Publica (ou republica) o deck de trabalho como snapshot. Republicar mantém
 * o mesmo id publicado — logo, avaliações e downloads são preservados.
 */
/** Erro lançado quando o banco recusa republicar um deck baixado protegido. */
export const REPUBLISH_FORBIDDEN = 'REPUBLISH_FORBIDDEN';

export async function publishDeck(
  userId: string,
  deck: Deck,
  author: PublicIdentity,
  license: DeckLicense = 'protected',
): Promise<string> {
  const preset = presetFor(license);
  const meta = {
    author_id: userId,
    source_playlist_id: deck.id,
    title: deck.title,
    description: deck.description || null,
    cover_url: deck.coverUrl,
    tags: deck.tags,
    card_count: deck.cards.length,
    author_name: author.name,
    author_avatar_url: author.avatarUrl,
    license,
    allow_export: preset.allowExport,
    allow_redistribute: preset.allowRedistribute,
    // original_author_* é preenchido pelo trigger enforce_deck_provenance.
    updated_at: new Date().toISOString(),
  };

  const existing = await getPublishedFor(deck.id);
  let communityDeckId: string;

  // O trigger enforce_deck_provenance recusa republicar cópia baixada protegida
  // com a mensagem REPUBLISH_FORBIDDEN — traduz para um erro tipado.
  const guard = (error: { message?: string } | null) => {
    if (!error) return;
    if ((error.message ?? '').includes(REPUBLISH_FORBIDDEN)) {
      throw new Error(REPUBLISH_FORBIDDEN);
    }
    throw error;
  };

  if (existing) {
    const { error } = await supabase
      .from('community_decks')
      .update(meta)
      .eq('id', existing.id);
    guard(error);
    communityDeckId = existing.id;
    // Substitui os cards do snapshot pelos atuais.
    await supabase
      .from('community_cards')
      .delete()
      .eq('community_deck_id', communityDeckId);
  } else {
    const { data, error } = await supabase
      .from('community_decks')
      .insert(meta)
      .select('id')
      .single();
    guard(error);
    communityDeckId = data!.id as string;
  }

  const cardRows = deck.cards.map((c, i) => ({
    community_deck_id: communityDeckId,
    front: c.front,
    back: c.back,
    images: c.images,
    quiz_options: c.quizOptions,
    position: i,
  }));
  if (cardRows.length > 0) {
    const { error } = await supabase.from('community_cards').insert(cardRows);
    if (error) throw error;
  }
  return communityDeckId;
}

/** Remove o deck da comunidade (o deck de trabalho privado permanece). */
export async function unpublishDeck(sourcePlaylistId: string): Promise<void> {
  const { error } = await supabase
    .from('community_decks')
    .delete()
    .eq('source_playlist_id', sourcePlaylistId);
  if (error) throw error;
}

// ── Download (cópia para a conta) ────────────────────────────────────────────

/** Baixa um deck público: cria uma cópia na conta (SM-2 do zero). */
export async function downloadDeck(
  userId: string,
  communityDeckId: string,
): Promise<Deck | null> {
  const full = await getCommunityDeck(communityDeckId);
  if (!full) return null;

  const deck = await db.decks.create(
    userId,
    {
      title: full.deck.title,
      emoji: '',
      color: '',
      sourceType: 'file',
      tags: full.deck.tags,
      coverUrl: full.deck.cover_url,
      description: full.deck.description,
      // Proveniência + CACHE das permissões da licença no momento do download:
      // a cópia sabe de onde veio e o que pode fazer, sem depender da origem.
      originCommunityDeckId: communityDeckId,
      originAuthorId: full.deck.author_id,
      originAuthorName: full.deck.author_name,
      originAllowExport: full.deck.allow_export,
      originAllowRedistribute: full.deck.allow_redistribute,
    },
    full.cards.map(c => ({
      front: c.front,
      back: c.back,
      images: c.images,
      quizOptions: c.quiz_options,
    })),
  );

  // Registra o download (idempotente) e incrementa o contador público.
  await supabase.rpc('register_download', { p_deck: communityDeckId });
  return deck;
}

export async function hasDownloaded(
  communityDeckId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('deck_downloads')
    .select('user_id')
    .eq('community_deck_id', communityDeckId)
    .eq('user_id', userId)
    .maybeSingle();
  return data != null;
}

// ── Avaliações ───────────────────────────────────────────────────────────────

export async function listReviews(
  communityDeckId: string,
): Promise<DeckRatingRow[]> {
  const { data, error } = await supabase
    .from('deck_ratings')
    .select('*')
    .eq('community_deck_id', communityDeckId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as DeckRatingRow[];
}

export async function getMyRating(
  communityDeckId: string,
  userId: string,
): Promise<DeckRatingRow | null> {
  const { data } = await supabase
    .from('deck_ratings')
    .select('*')
    .eq('community_deck_id', communityDeckId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as DeckRatingRow) ?? null;
}

/** Cria ou atualiza a avaliação do usuário (exige ter baixado o deck — RLS). */
export async function rateDeck(params: {
  communityDeckId: string;
  userId: string;
  stars: number;
  comment: string | null;
  reviewer: PublicIdentity;
}): Promise<void> {
  const { error } = await supabase.from('deck_ratings').upsert(
    {
      community_deck_id: params.communityDeckId,
      user_id: params.userId,
      stars: params.stars,
      comment: params.comment,
      reviewer_name: params.reviewer.name,
      reviewer_avatar_url: params.reviewer.avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'community_deck_id,user_id' },
  );
  if (error) throw error;
}

// ── Denúncia ─────────────────────────────────────────────────────────────────

/** Registra uma denúncia de um deck da comunidade (uma por usuário por deck). */
export async function reportDeck(params: {
  communityDeckId: string;
  userId: string;
  reason: ReportReason;
  detail?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('deck_reports').upsert(
    {
      community_deck_id: params.communityDeckId,
      reporter_id: params.userId,
      reason: params.reason,
      detail: params.detail ?? null,
    },
    { onConflict: 'community_deck_id,reporter_id' },
  );
  if (error) throw error;
}
