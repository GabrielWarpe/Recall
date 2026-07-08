import { format } from 'date-fns';
import { supabase } from './supabase';
import { computeStreak, computeLongestStreak } from '@/utils/streak';
import type {
  Profile,
  PlaylistRow,
  FlashcardRow,
  StudySessionRow,
  CardReviewRow,
  SourceType,
} from '@/types/db';
import type { Deck, Flashcard, StudySession } from '@/types';

// ── Mapeamento DB row → modelo do app ────────────────────────────────────────

function rowToFlashcard(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    createdAt: row.created_at,
    interval: row.interval,
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    nextReview: row.next_review_date,
    lastReviewed: row.last_review_date ?? undefined,
    mastered: row.mastered,
    images: row.images ?? [],
  };
}

function rowsToDeck(playlist: PlaylistRow, cards: FlashcardRow[]): Deck {
  return {
    id: playlist.id,
    title: playlist.name,
    description: '',
    color: playlist.color,
    emoji: playlist.emoji,
    tags: playlist.tags ?? [],
    cards: cards.map(rowToFlashcard),
    createdAt: playlist.created_at,
    lastStudied: playlist.last_studied_at ?? undefined,
  };
}

/** Card de entrada nas criações (front/back + imagens opcionais). */
export interface NewCardInput {
  front: string;
  back: string;
  images?: string[];
}

/** Linha pronta para inserir; `images` só entra no INSERT quando presente. */
type NewFlashcardRow = Omit<FlashcardRow, 'id' | 'created_at' | 'images'> & {
  images?: string[];
};

/** Monta linhas de flashcard prontas para inserir, com defaults do SM-2. */
function buildCardRows(
  userId: string,
  playlistId: string,
  cards: NewCardInput[],
): NewFlashcardRow[] {
  const nowIso = new Date().toISOString();
  return cards.map(c => ({
    playlist_id: playlistId,
    user_id: userId,
    front: c.front,
    back: c.back,
    type: 'concept' as const,
    interval: 1,
    ease_factor: 2.5,
    repetitions: 0,
    next_review_date: nowIso,
    last_review_date: null,
    mastered: false,
    // SEMPRE presente (mesmo vazio): num INSERT em lote, o PostgREST monta a
    // lista de colunas pela união das chaves de todos os objetos do array —
    // se um card do lote tiver `images` e outro não, o card sem a chave
    // recebe NULL explícito (não o DEFAULT da coluna), violando o NOT NULL.
    // Manter a mesma forma em toda linha evita esse NULL-fill.
    images: c.images ?? [],
  }));
}

function rowToSession(
  row: StudySessionRow,
  deckTitle: string,
): StudySession {
  const duration =
    row.ended_at != null
      ? Math.max(
          0,
          Math.round(
            (new Date(row.ended_at).getTime() -
              new Date(row.started_at).getTime()) /
              1000,
          ),
        )
      : 0;
  return {
    id: row.id,
    deckId: row.playlist_id,
    deckTitle,
    date: row.started_at,
    correct: row.correct_count,
    hard: row.hard_count,
    again: row.again_count,
    total: row.cards_reviewed,
    durationSeconds: duration,
  };
}

// ── API primitiva (espelha as tabelas) ───────────────────────────────────────

export const db = {
  playlists: {
    async getAll(userId: string): Promise<PlaylistRow[]> {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async create(
      // `tags` opcional: quando omitido, a coluna nem entra no INSERT —
      // permite gravar mesmo num banco que ainda não rodou a migração.
      data: Omit<PlaylistRow, 'id' | 'created_at' | 'last_studied_at' | 'tags'> & {
        tags?: string[];
      },
    ): Promise<PlaylistRow> {
      const { data: row, error } = await supabase
        .from('playlists')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    async update(id: string, data: Partial<PlaylistRow>): Promise<void> {
      const { error } = await supabase
        .from('playlists')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('playlists').delete().eq('id', id);
      if (error) throw error;
    },
  },

  flashcards: {
    async getByPlaylist(playlistId: string): Promise<FlashcardRow[]> {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },

    async getOne(id: string): Promise<FlashcardRow | null> {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('id', id)
        .single();
      if (error) return null;
      return data;
    },

    async countMastered(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('mastered', true);
      if (error) return 0;
      return count ?? 0;
    },

    async create(data: NewFlashcardRow): Promise<FlashcardRow> {
      const { data: row, error } = await supabase
        .from('flashcards')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    async createMany(cards: NewFlashcardRow[]): Promise<FlashcardRow[]> {
      if (cards.length === 0) return [];
      const { data, error } = await supabase
        .from('flashcards')
        .insert(cards)
        .select();
      if (error) throw error;
      return data ?? [];
    },

    async update(id: string, data: Partial<FlashcardRow>): Promise<void> {
      const { error } = await supabase
        .from('flashcards')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase.from('flashcards').delete().eq('id', id);
      if (error) throw error;
    },

    async getDueToday(userId: string): Promise<FlashcardRow[]> {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', new Date().toISOString());
      if (error) throw error;
      return data ?? [];
    },
  },

  sessions: {
    async create(
      data: Omit<StudySessionRow, 'id'>,
    ): Promise<StudySessionRow> {
      const { data: row, error } = await supabase
        .from('study_sessions')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    async update(id: string, data: Partial<StudySessionRow>): Promise<void> {
      const { error } = await supabase
        .from('study_sessions')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },

    /** Histórico de tentativas de um deck específico (mais recentes primeiro). */
    async getByDeck(
      deckId: string,
      deckTitle = '',
      limit = 20,
    ): Promise<StudySession[]> {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('playlist_id', deckId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as StudySessionRow[]).map(row =>
        rowToSession(row, deckTitle),
      );
    },

    /** Sessões recentes com o nome da playlist (join), no formato do app. */
    async getRecent(userId: string, limit = 50): Promise<StudySession[]> {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*, playlists(name)')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      type JoinedRow = StudySessionRow & { playlists: { name: string } | null };
      return ((data ?? []) as JoinedRow[]).map(row =>
        rowToSession(row, row.playlists?.name ?? 'Deck'),
      );
    },
  },

  reviews: {
    /** Registra uma avaliação individual (De novo/Difícil/Bom/Fácil) — a
     * base para retenção ao longo do tempo e detecção de leeches. */
    async log(data: Omit<CardReviewRow, 'id' | 'reviewed_at'>): Promise<void> {
      const { error } = await supabase.from('card_reviews').insert(data);
      if (error) throw error;
    },

    /** Cards com `threshold`+ "De novo" no total — os que mais travam o
     * aprendizado. Agregado no cliente (mesmo padrão de streak/conquistas
     * já usado no app): busca só a coluna necessária, conta em JS. */
    async getLeeches(
      userId: string,
      threshold = 4,
    ): Promise<{ cardId: string; againCount: number }[]> {
      const { data, error } = await supabase
        .from('card_reviews')
        .select('card_id')
        .eq('user_id', userId)
        .eq('grade', 'again')
        .limit(5000);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { card_id: string }[]) {
        counts.set(row.card_id, (counts.get(row.card_id) ?? 0) + 1);
      }
      return [...counts.entries()]
        .filter(([, count]) => count >= threshold)
        .map(([cardId, againCount]) => ({ cardId, againCount }))
        .sort((a, b) => b.againCount - a.againCount);
    },

    /** Retenção por dia nos últimos `days` dias: % de revisões que não
     * foram "De novo". Dias sem nenhuma revisão vêm com total=0 (o
     * chamador decide como exibir — não é 0% de retenção, é "sem dado"). */
    async getRetentionByDay(
      userId: string,
      days: number,
    ): Promise<{ date: string; total: number; retained: number }[]> {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('card_reviews')
        .select('grade, reviewed_at')
        .eq('user_id', userId)
        .gte('reviewed_at', since.toISOString());
      if (error) throw error;

      const buckets = new Map<string, { total: number; retained: number }>();
      for (const row of (data ?? []) as {
        grade: string;
        reviewed_at: string;
      }[]) {
        const key = format(new Date(row.reviewed_at), 'yyyy-MM-dd');
        const b = buckets.get(key) ?? { total: 0, retained: 0 };
        b.total += 1;
        if (row.grade !== 'again') b.retained += 1;
        buckets.set(key, b);
      }

      return Array.from({ length: days }, (_, i) => {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        const key = format(d, 'yyyy-MM-dd');
        const b = buckets.get(key) ?? { total: 0, retained: 0 };
        return { date: key, ...b };
      });
    },
  },

  profile: {
    async get(userId: string): Promise<Profile | null> {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) return null;
      return data;
    },

    async update(userId: string, data: Partial<Profile>): Promise<void> {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId);
      if (error) throw error;
    },

    /**
     * Recalcula a sequência (streak) a partir das datas reais das sessões.
     * Determinístico e auto-corretivo — não confia em um contador acumulado.
     */
    async updateStreak(userId: string): Promise<Profile | null> {
      const profile = await db.profile.get(userId);
      if (!profile) return null;

      const sessions = await db.sessions.getRecent(userId, 365);
      const dates = sessions.map(s => s.date);
      const current = computeStreak(dates);
      // Recalcula o recorde a partir dos dados reais (auto-corrige valores antigos).
      const longest = computeLongestStreak(dates);
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      await db.profile.update(userId, {
        current_streak: current,
        longest_streak: longest,
        last_study_date: todayStr,
      });
      return {
        ...profile,
        current_streak: current,
        longest_streak: longest,
        last_study_date: todayStr,
      };
    },
  },

  // ── Operações no formato Deck (usadas pela maioria das telas) ───────────────
  decks: {
    /** Todos os decks do usuário, já montados com seus cards. */
    async getAll(userId: string): Promise<Deck[]> {
      const playlists = await db.playlists.getAll(userId);
      if (playlists.length === 0) return [];

      const { data: cards, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;

      const byPlaylist = new Map<string, FlashcardRow[]>();
      for (const card of (cards ?? []) as FlashcardRow[]) {
        const list = byPlaylist.get(card.playlist_id) ?? [];
        list.push(card);
        byPlaylist.set(card.playlist_id, list);
      }
      return playlists.map(p => rowsToDeck(p, byPlaylist.get(p.id) ?? []));
    },

    async getOne(playlistId: string): Promise<Deck | null> {
      const { data: playlist, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();
      if (error || !playlist) return null;
      const cards = await db.flashcards.getByPlaylist(playlistId);
      return rowsToDeck(playlist as PlaylistRow, cards);
    },

    /** Cria a playlist e insere todos os cards de uma vez. */
    async create(
      userId: string,
      meta: {
        title: string;
        emoji: string;
        color: string;
        sourceType: SourceType;
        tags?: string[];
      },
      cards: NewCardInput[],
    ): Promise<Deck> {
      const base = {
        user_id: userId,
        name: meta.title,
        emoji: meta.emoji,
        color: meta.color,
        source_type: meta.sourceType,
      };

      let playlist;
      try {
        playlist = await db.playlists.create({
          ...base,
          // Só entra no INSERT quando informado (tolera banco sem a coluna).
          ...(meta.tags !== undefined ? { tags: meta.tags } : {}),
        });
      } catch (e) {
        // Banco ainda sem a coluna `tags` (migração não aplicada): repete o
        // INSERT sem o campo em vez de quebrar a criação de decks inteira.
        const msg = (e as { message?: string } | null)?.message ?? '';
        if (meta.tags !== undefined && /tags/i.test(msg)) {
          playlist = await db.playlists.create(base);
        } else {
          throw e;
        }
      }

      const cardRows = await db.flashcards.createMany(
        buildCardRows(userId, playlist.id, cards),
      );
      return rowsToDeck(playlist, cardRows);
    },

    /** Anexa novos cards a um deck existente. */
    async addCards(
      userId: string,
      deckId: string,
      cards: NewCardInput[],
    ): Promise<FlashcardRow[]> {
      return db.flashcards.createMany(buildCardRows(userId, deckId, cards));
    },

    async delete(playlistId: string): Promise<void> {
      // ON DELETE CASCADE remove os flashcards/sessões associados.
      await db.playlists.delete(playlistId);
    },

    /** Persiste o resultado de uma revisão SM-2 em um único card. */
    async reviewCard(card: Flashcard): Promise<void> {
      await db.flashcards.update(card.id, {
        interval: card.interval,
        ease_factor: card.easeFactor,
        repetitions: card.repetitions,
        next_review_date: card.nextReview,
        last_review_date: card.lastReviewed ?? new Date().toISOString(),
        mastered: card.repetitions >= 3,
      });
    },

    async touchStudied(playlistId: string): Promise<void> {
      await db.playlists.update(playlistId, {
        last_studied_at: new Date().toISOString(),
      });
    },
  },
};
