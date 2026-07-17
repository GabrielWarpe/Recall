import type { Deck, Flashcard } from '@/types';

/**
 * O quiz agora usa alternativas AUTORADAS por card (`quizOptions` = erradas;
 * a correta é o `back`). Um card é pergunta de quiz quando tem 2+ alternativas
 * erradas (3+ opções no total). Cards sem alternativas são só flashcards.
 */
export function cardSupportsQuiz(card: Pick<Flashcard, 'quizOptions'>): boolean {
  return (card.quizOptions?.filter(o => o.trim().length > 0).length ?? 0) >= 2;
}

/** O deck oferece quiz quando ao menos um card tem alternativas autoradas. */
export function deckSupportsQuiz(deck: Pick<Deck, 'cards'>): boolean {
  return deck.cards.some(cardSupportsQuiz);
}

/** Quantas alternativas erradas um card pode ter (total = correta + estas). */
export const MAX_QUIZ_OPTIONS = 3;

export interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/** Hash determinístico (djb2) de uma string — semente de sorteios estáveis. */
export function hashStr(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** PRNG determinístico (mulberry32) — mesmo seed, mesma sequência. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates com seed: embaralha igual sempre que o seed for o mesmo. */
export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Monta as alternativas de um card: o verso correto + as alternativas erradas
 * escritas pelo autor (ou geradas pela IA junto com a pergunta).
 *
 * Com `seed`, a ordem é ESTÁVEL para o mesmo card+seed — essencial para a
 * navegação livre: ao voltar a uma questão respondida, o índice salvo precisa
 * apontar para a mesma alternativa. Sem seed, embaralha aleatório (legado).
 */
export function buildOptions(
  card: Pick<Flashcard, 'back' | 'quizOptions'> & { id?: string },
  seed?: number,
): QuizOption[] {
  const wrong = (card.quizOptions ?? [])
    .map(o => o.trim())
    .filter(o => o.length > 0)
    .slice(0, MAX_QUIZ_OPTIONS);

  const all = [
    { text: card.back, isCorrect: true },
    ...wrong.map(text => ({ text, isCorrect: false })),
  ];
  return seed != null
    ? seededShuffle(all, hashStr(card.id ?? card.back) ^ seed)
    : shuffle(all);
}
