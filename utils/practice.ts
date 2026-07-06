import type { Deck } from '@/types';

/**
 * O quiz de múltipla escolha precisa de pelo menos 2 cards com versos
 * DISTINTOS — é o mínimo para haver 1 alternativa errada. Com 2–3 cards o
 * quiz mostra 2–3 alternativas; com 4+ mostra as 4 completas.
 */
export function deckSupportsQuiz(deck: Pick<Deck, 'cards'>): boolean {
  if (deck.cards.length < 2) return false;
  const distinctBacks = new Set(
    deck.cards.map(c => c.back.trim().toLowerCase()).filter(b => b.length > 0),
  );
  return distinctBacks.size >= 2;
}
