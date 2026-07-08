import type { Flashcard, Deck, Grade } from '@/types';
import { storage } from './storage';

interface GeneratedCard {
  front: string;
  back: string;
}

/** Bloco de conteúdo enviado à API (texto, imagem ou documento PDF). */
type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    };

/** Arquivo já lido em base64, pronto para virar cards por IA. */
export interface FileAttachment {
  base64: string;
  mimeType: string;
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const CARD_INSTRUCTIONS = `Return ONLY a valid JSON array with no other text. Each item must have "front" (question or concept) and "back" (answer or explanation) fields. Keep each card concise and focused on a single idea. Write the cards in the same language as the source content.`;

/** Chamada única à API: monta a requisição, valida e extrai o array de cards. */
async function requestCards(
  content: string | ContentBlock[],
): Promise<GeneratedCard[]> {
  // A chave da IA vem do ambiente (.env) ou de uma config local legada.
  const envKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const apiKey = envKey || (await storage.getSettings()).apiKey;
  if (!apiKey) {
    throw new Error(
      'Chave da API não configurada. Defina EXPO_PUBLIC_ANTHROPIC_API_KEY no arquivo .env.',
    );
  }

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
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err.error?.message ?? `Erro na API: ${response.status}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
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

/**
 * Gera cards a partir de um tópico/texto e, opcionalmente, imagens de contexto
 * (foto de página de livro, print de aula, diagrama, exercício...). Texto e
 * imagens vão juntos na mesma mensagem para o modelo.
 */
export async function generateFlashcards(
  input: string,
  count: number = 10,
  images: FileAttachment[] = [],
): Promise<GeneratedCard[]> {
  const source = input.trim();

  if (images.length === 0) {
    const prompt = `Generate exactly ${count} educational flashcards about the following topic or content.

${CARD_INSTRUCTIONS}

Content:
${source}`;
    return requestCards(prompt);
  }

  const imageBlocks: ContentBlock[] = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
  }));

  const prompt = `Generate exactly ${count} educational flashcards from the attached image(s)${
    source ? ' and the notes below' : ''
  }.

${CARD_INSTRUCTIONS}${
    source
      ? `

Notes:
${source}`
      : ''
  }`;

  return requestCards([...imageBlocks, { type: 'text', text: prompt }]);
}

/**
 * Gera cards a partir de um arquivo (PDF ou imagem). O Claude lê o PDF/imagem
 * nativamente — sem parser local. Limites da API: 32 MB por requisição e 600
 * páginas por PDF.
 */
export async function generateFlashcardsFromFile(
  file: FileAttachment,
  count: number = 10,
): Promise<GeneratedCard[]> {
  const fileBlock: ContentBlock =
    file.mimeType === 'application/pdf'
      ? {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: file.base64,
          },
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: file.mimeType, data: file.base64 },
        };

  const prompt = `Generate exactly ${count} educational flashcards from the attached file.

${CARD_INSTRUCTIONS}`;

  return requestCards([fileBlock, { type: 'text', text: prompt }]);
}

export function makeFlashcard(
  front: string,
  back: string,
  images: string[] = [],
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
