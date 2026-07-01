import type { Flashcard, Deck } from '@/types';
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

// Simplified SM-2 algorithm
export function reviewCard(card: Flashcard, correct: boolean): Flashcard {
  const now = new Date();
  let { interval, repetitions, easeFactor } = card;

  if (correct) {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1);
  } else {
    repetitions = 0;
    interval = 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
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

export function getDueCards(deck: Pick<Deck, 'cards'>): Flashcard[] {
  const now = new Date();
  return deck.cards.filter(c => new Date(c.nextReview) <= now);
}

export function getNewCards(deck: Pick<Deck, 'cards'>): Flashcard[] {
  return deck.cards.filter(c => c.repetitions === 0);
}
