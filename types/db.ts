/**
 * Tipos que espelham as linhas (rows) das tabelas do Supabase.
 * Os tipos de domínio do app (Deck/Flashcard) ficam em types/index.ts —
 * a conversão entre os dois é feita em services/database.ts.
 */

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  daily_goal: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  created_at: string;
}

export type SourceType = 'manual' | 'ai' | 'file';

export interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  source_type: SourceType;
  tags: string[];
  created_at: string;
  last_studied_at: string | null;
}

export type CardType = 'concept' | 'definition' | 'fact';

export interface FlashcardRow {
  id: string;
  playlist_id: string;
  user_id: string;
  front: string;
  back: string;
  type: CardType;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review_date: string;
  last_review_date: string | null;
  mastered: boolean;
  /** URLs públicas das imagens do card (Supabase Storage). */
  images: string[];
  created_at: string;
}

export interface StudySessionRow {
  id: string;
  user_id: string;
  playlist_id: string;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  correct_count: number;
  hard_count: number;
  again_count: number;
}

export interface CardReviewRow {
  id: string;
  user_id: string;
  card_id: string;
  playlist_id: string;
  grade: 'again' | 'hard' | 'good' | 'easy';
  interval_before: number;
  interval_after: number;
  reviewed_at: string;
}
