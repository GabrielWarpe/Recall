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
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  color: string;
  emoji: string;
  cards: Flashcard[];
  createdAt: string;
  lastStudied?: string;
}

export interface StudySession {
  id: string;
  deckId: string;
  deckTitle: string;
  date: string;
  correct: number;
  incorrect: number;
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
