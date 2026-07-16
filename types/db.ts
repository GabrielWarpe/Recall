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
  // Proveniência (null = deck autoral). Cópia baixada guarda a origem e um
  // cache das permissões da licença no momento do download.
  origin_community_deck_id: string | null;
  origin_author_id: string | null;
  origin_author_name: string | null;
  origin_allow_export: boolean | null;
  origin_allow_redistribute: boolean | null;
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

// ── Comunidade (snapshot de decks públicos) ─────────────────────────────────

export type DeckLicense = 'protected' | 'shareable' | 'open';

export interface CommunityDeckRow {
  id: string;
  author_id: string;
  source_playlist_id: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  tags: string[];
  card_count: number;
  downloads_count: number;
  rating_avg: number;
  rating_count: number;
  author_name: string | null;
  author_avatar_url: string | null;
  /** Licença escolhida na publicação; null em decks antigos = 'protected'. */
  license: DeckLicense | null;
  allow_export: boolean;
  allow_redistribute: boolean;
  /** Autor da raiz da cadeia, quando este deck é uma adaptação de outro. */
  original_author_id: string | null;
  original_author_name: string | null;
  published_at: string;
  updated_at: string;
}

export interface CommunityCardRow {
  id: string;
  community_deck_id: string;
  front: string;
  back: string;
  images: string[];
  quiz_options: string[];
  position: number;
}

export interface DeckRatingRow {
  id: string;
  community_deck_id: string;
  user_id: string;
  stars: number;
  comment: string | null;
  reviewer_name: string | null;
  reviewer_avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportReason = 'plagiarism' | 'inappropriate' | 'spam' | 'other';

export interface DeckReportRow {
  id: string;
  community_deck_id: string;
  reporter_id: string;
  reason: ReportReason;
  detail: string | null;
  created_at: string;
}
