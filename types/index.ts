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
  /**
   * Alternativas ERRADAS autoradas do quiz (a correta é o `back`). Com 2+
   * alternativas o card vira pergunta de quiz; vazio = só flashcard.
   */
  quizOptions: string[];
}

/**
 * Proveniência de um deck baixado da comunidade. `null` no domínio Deck = deck
 * autoral (criado pelo próprio usuário). O cache de permissões (`allowExport`/
 * `allowRedistribute`) é o da licença no momento do download.
 */
export interface DeckOrigin {
  communityDeckId: string;
  authorId: string | null;
  authorName: string | null;
  allowExport: boolean;
  allowRedistribute: boolean;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  color: string;
  emoji: string;
  /** Foto de capa (URL no Storage). Sem capa → ícone padrão "livrinho". */
  coverUrl: string | null;
  tags: string[];
  cards: Flashcard[];
  createdAt: string;
  lastStudied?: string;
  /** null = deck autoral; preenchido quando foi baixado da comunidade. */
  origin: DeckOrigin | null;
}

/**
 * Modo de estudo de uma sessão. Sessões antigas (sem coluna) contam como
 * 'flash'. 'mixed' = flashcards + quiz intercalados (StudyModePicker).
 */
export type StudyMode = 'flash' | 'quiz' | 'write' | 'mixed';

/** Cronômetro: crescente (tempo decorrido) ou regressivo (limite). */
export type StudyTimerMode = 'up' | 'down';

/**
 * A que o cronômetro se aplica. Hoje a sessão inteira; `'card'` (limite por
 * card/questão) entra aqui depois — `useStudyTimer` já ramifica por este
 * campo, então adicionar o modo novo não exige refazer a configuração.
 */
export type StudyTimerScope = 'session';

/** Configuração do cronômetro de UMA sessão de estudo (qualquer modo). */
export interface StudyTimerConfig {
  enabled: boolean;
  mode: StudyTimerMode;
  /** Só usado no modo regressivo. */
  limitSeconds: number;
  /** Mostrar o relógio na tela. Oculto, o tempo continua sendo medido. */
  visible: boolean;
  scope: StudyTimerScope;
}

export interface StudySession {
  id: string;
  deckId: string;
  deckTitle: string;
  date: string;
  mode?: StudyMode;
  /** Avaliados como Bom/Fácil. */
  correct: number;
  /** Avaliados como Difícil — passaram, mas com esforço (não é erro). */
  hard: number;
  /** Vezes que "De novo" foi escolhido nesta sessão (erros de verdade). */
  again: number;
  total: number;
  durationSeconds: number;
}

export type StudyPhase = 'idle' | 'studying' | 'finished';

/** Nível de avaliação de um card na revisão (estilo Anki). */
export type Grade = 'again' | 'hard' | 'good' | 'easy';
