import { format } from 'date-fns';
import { supabase } from './supabase';
import { computeStreak, computeLongestStreak } from '@/utils/streak';
import type {
  Profile,
  PlaylistRow,
  FlashcardRow,
  StudySessionRow,
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
  };
}

function rowsToDeck(playlist: PlaylistRow, cards: FlashcardRow[]): Deck {
  return {
    id: playlist.id,
    title: playlist.name,
    description: '',
    color: playlist.color,
    emoji: playlist.emoji,
    cards: cards.map(rowToFlashcard),
    createdAt: playlist.created_at,
    lastStudied: playlist.last_studied_at ?? undefined,
  };
}

/** Monta linhas de flashcard prontas para inserir, com defaults do SM-2. */
function buildCardRows(
  userId: string,
  playlistId: string,
  cards: { front: string; back: string }[],
): Omit<FlashcardRow, 'id' | 'created_at'>[] {
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
  }));
}

function rowToSession(
  row: StudySessionRow,
  deckTitle: string,
): StudySession {
  const total = row.cards_reviewed;
  const correct = row.correct_count;
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
    correct,
    incorrect: Math.max(0, total - correct),
    total,
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
      data: Omit<PlaylistRow, 'id' | 'created_at' | 'last_studied_at'>,
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

    async create(
      data: Omit<FlashcardRow, 'id' | 'created_at'>,
    ): Promise<FlashcardRow> {
      const { data: row, error } = await supabase
        .from('flashcards')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return row;
    },

    async createMany(
      cards: Omit<FlashcardRow, 'id' | 'created_at'>[],
    ): Promise<FlashcardRow[]> {
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
      meta: { title: string; emoji: string; color: string; sourceType: SourceType },
      cards: { front: string; back: string }[],
    ): Promise<Deck> {
      const playlist = await db.playlists.create({
        user_id: userId,
        name: meta.title,
        emoji: meta.emoji,
        color: meta.color,
        source_type: meta.sourceType,
      });

      const cardRows = await db.flashcards.createMany(
        buildCardRows(userId, playlist.id, cards),
      );
      return rowsToDeck(playlist, cardRows);
    },

    /** Anexa novos cards a um deck existente. */
    async addCards(
      userId: string,
      deckId: string,
      cards: { front: string; back: string }[],
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
