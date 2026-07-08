export interface Flashcard {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  // SM-2 spaced repetition fields
  interval: number;
  repetitions: number;
  easeFactor: number;
  nextReview: string;
  lastReviewed?: string;
  /** Definido pelo banco ao revisar (3+ repetições corretas). */
  mastered: boolean;
  /** URLs públicas das imagens anexadas ao card. */
  images: string[];
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  color: string;
  emoji: string;
  tags: string[];
  cards: Flashcard[];
  createdAt: string;
  lastStudied?: string;
}

export interface StudySession {
  id: string;
  deckId: string;
  deckTitle: string;
  date: string;
  /** Avaliados como Bom/Fácil. */
  correct: number;
  /** Avaliados como Difícil — passaram, mas com esforço (não é erro). */
  hard: number;
  /** Vezes que "De novo" foi escolhido nesta sessão (erros de verdade). */
  again: number;
  total: number;
  durationSeconds: number;
}

export interface UserSettings {
  apiKey: string;
  dailyGoal: number;
  notifications: boolean;
}

export interface StudyResult {
  cardId: string;
  correct: boolean;
}

export type StudyPhase = 'idle' | 'studying' | 'finished';

/** Nível de avaliação de um card na revisão (estilo Anki). */
export type Grade = 'again' | 'hard' | 'good' | 'easy';
