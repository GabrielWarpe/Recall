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
  /** Preferências do app (tema, cor, fonte, estudo…) — sincronizadas na conta. */
  settings: Record<string, unknown>;
  /** Se o usuário já viu o onboarding (por conta, não por aparelho). */
  onboarding_done: boolean;
  created_at: string;
}

export type SourceType = 'manual' | 'ai' | 'file';

export interface PlaylistRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  cover_url: string | null;
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
  /** Alternativas ERRADAS do quiz (a correta é `back`); 2+ = card tem quiz. */
  quiz_options: string[];
  created_at: string;
}

export interface StudySessionRow {
  id: string;
  user_id: string;
  /** null quando o deck foi excluído (o histórico permanece). */
  playlist_id: string | null;
  started_at: string;
  ended_at: string | null;
  cards_reviewed: number;
  correct_count: number;
  hard_count: number;
  again_count: number;
  /** 'flash' | 'quiz' | 'write'; null em sessões antigas (contam como flash). */
  mode?: string | null;
  /**
   * Tempo REAL de tela ativa, em segundos (não conta segundo plano). Null em
   * sessões antigas — nelas a duração segue vindo de ended_at - started_at.
   */
  active_seconds?: number | null;
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
