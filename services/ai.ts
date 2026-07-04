import type { Flashcard, Deck, Grade } from '@/types';
import { storage } from './storage';

interface GeneratedCard {
  front: string;
  back: string;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function generateFlashcards(
  input: string,
  count: number = 10,
): Promise<GeneratedCard[]> {
  // A chave da IA vem do ambiente (.env) ou de uma config local legada.
  const envKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const apiKey = envKey || (await storage.getSettings()).apiKey;
  if (!apiKey) {
    throw new Error(
      'Chave da API não configurada. Defina EXPO_PUBLIC_ANTHROPIC_API_KEY no arquivo .env.',
    );
  }

  const prompt = `Generate exactly ${count} educational flashcards about the following topic or content.

Return ONLY a valid JSON array with no other text. Each item must have "front" (question or concept) and "back" (answer or explanation) fields. Keep each card concise and focused on a single idea.

Content:
${input}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erro na API: ${response.status}`);
  }

  const data = await response.json() as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? '';

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Não foi possível interpretar a resposta da IA como JSON.');
  }

  const cards = JSON.parse(jsonMatch[0]) as GeneratedCard[];
  if (!Array.isArray(cards)) {
    throw new Error('Resposta da IA não é um array válido.');
  }

  return cards.filter(c => c.front && c.back);
}

export function makeFlashcard(front: string, back: string): Flashcard {
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
 * até `newLimit` cards novos. Se `newLimit` for 0 ou negativo, não inclui novos.
 */
export function getSessionCards(
  deck: Pick<Deck, 'cards'>,
  newLimit: number,
): Flashcard[] {
  const due = getDueCards(deck);
  const news = newLimit > 0 ? getNewCards(deck).slice(0, newLimit) : [];
  return [...due, ...news];
}
