import type { Flashcard, Deck, Grade } from '@/types';

// A geração por IA vive na Edge Function `generate-cards` (backend) — o
// cliente fica em lib/api/generateCards.ts. Aqui restam apenas o SM-2 e os
// utilitários de sessão/estatística dos cards.

export function makeFlashcard(
  front: string,
  back: string,
  images: string[] = [],
  quizOptions: string[] = [],
): Flashcard {
  const now = new Date().toISOString();
  return {
    id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    front,
    back,
    createdAt: now,
    interval: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReview: now,
    mastered: false,
    images,
    quizOptions,
  };
}

/**
 * SM-2 com avaliação de 4 níveis (De novo / Difícil / Bom / Fácil).
 * Mantém exatamente os mesmos campos persistidos de antes — só a fórmula muda.
 * O armazenamento do intervalo é em dias; "De novo" reagenda para o dia seguinte
 * (a re-exibição imediata é tratada pela fila da sessão, não pelo agendamento).
 */
export function reviewCard(card: Flashcard, grade: Grade): Flashcard {
  const now = new Date();
  let { interval, repetitions, easeFactor } = card;

  if (grade === 'again') {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = grade === 'easy' ? 4 : 1;
    } else if (repetitions === 2) {
      interval = grade === 'hard' ? 3 : 6;
    } else {
      const factor =
        grade === 'hard' ? 1.2 : grade === 'easy' ? easeFactor * 1.3 : easeFactor;
      interval = Math.max(1, Math.round(interval * factor));
    }
    const delta = grade === 'hard' ? -0.15 : grade === 'easy' ? 0.15 : 0;
    easeFactor = Math.max(1.3, easeFactor + delta);
  }

  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    ...card,
    interval,
    repetitions,
    easeFactor,
    nextReview: nextReview.toISOString(),
    lastReviewed: now.toISOString(),
  };
}

/** Cards já vistos cujo próximo review já venceu (devidos de verdade). */
export function getDueCards(deck: Pick<Deck, 'cards'>): Flashcard[] {
  const now = new Date();
  return deck.cards.filter(
    c => c.repetitions > 0 && new Date(c.nextReview) <= now,
  );
}

/** Cards nunca estudados. */
export function getNewCards(deck: Pick<Deck, 'cards'>): Flashcard[] {
  return deck.cards.filter(c => c.repetitions === 0);
}

/**
 * Monta a lista de uma sessão de repetição espaçada: todos os cards devidos +
 * todos os cards novos (nunca estudados).
 */
export function getSessionCards(deck: Pick<Deck, 'cards'>): Flashcard[] {
  return [...getDueCards(deck), ...getNewCards(deck)];
}

export type Maturity = 'new' | 'learning' | 'young' | 'mature';

/** Estágio de maturidade de um card, ao estilo Anki (corte em 21 dias). */
export function cardMaturity(c: Pick<Flashcard, 'repetitions' | 'interval'>): Maturity {
  if (c.repetitions === 0) return 'new';
  if (c.interval < 7) return 'learning';
  if (c.interval < 21) return 'young';
  return 'mature';
}

/**
 * Previsão de revisões para os próximos `days` dias. O primeiro dia (hoje)
 * inclui tudo que já está atrasado, não só o que vence exatamente hoje —
 * senão um usuário que ficou dias sem estudar veria "0" hoje e uma pilha
 * escondida em dias passados. Só considera cards já vistos: novos não têm
 * uma data de vencimento que signifique nada.
 */
export function forecastReviews(
  cards: Flashcard[],
  days: number,
): { day: Date; count: number }[] {
  const seen = cards.filter(c => c.repetitions > 0);
  const today = new Date();

  return Array.from({ length: days }, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() + i);

    if (i === 0) {
      const endToday = new Date(today);
      endToday.setHours(23, 59, 59, 999);
      return {
        day,
        count: seen.filter(c => new Date(c.nextReview) <= endToday).length,
      };
    }

    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return {
      day,
      count: seen.filter(c => {
        const t = new Date(c.nextReview).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      }).length,
    };
  });
}
