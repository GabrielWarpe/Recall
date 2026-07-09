import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';

/**
 * Cliente da Edge Function `generate-cards` (geração de flashcards/quizzes
 * por IA no backend — a chave da Anthropic vive no secret do Supabase, não
 * no app). Retorna um resultado discriminado para a UI mostrar feedback
 * claro sem try/catch.
 */

export type GenerateContentType = 'pdf' | 'image' | 'text' | 'docx';
export type GenerateMode = 'flashcards' | 'quiz';

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export interface GeneratedQuizQuestion {
  question: string;
  /** Sempre 4 alternativas. */
  options: string[];
  /** Índice (0-3) da alternativa correta em `options`. */
  correct_index: number;
  explanation: string;
}

/** Códigos estáveis retornados pela Edge Function (campo `error`). */
export type GenerateErrorCode =
  | 'conteudo_insuficiente'
  | 'no_credits'
  | 'rate_limit'
  | 'invalid_api_key'
  | 'overloaded'
  | 'resposta_invalida'
  | 'bad_request'
  | 'config'
  | 'upstream'
  | 'network'
  | 'unknown';

export type GenerateResult =
  | { ok: true; mode: 'flashcards'; cards: GeneratedFlashcard[] }
  | { ok: true; mode: 'quiz'; questions: GeneratedQuizQuestion[] }
  | { ok: false; code: GenerateErrorCode; message: string };

interface GenerateParams {
  contentType: GenerateContentType;
  /** Base64 para pdf/image/docx; texto puro para text. */
  content: string;
  mode: GenerateMode;
  count?: number;
  language?: string;
}

const FALLBACK_MESSAGE =
  'Não foi possível gerar os cards agora. Tente novamente.';

export async function generateCards({
  contentType,
  content,
  mode,
  count = 10,
  language = 'pt-BR',
}: GenerateParams): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke('generate-cards', {
    body: {
      content_type: contentType,
      content,
      mode,
      count,
      language,
    },
  });

  if (error) {
    // Erros HTTP da função trazem o body { error, message } no contexto.
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as {
        error?: string;
        message?: string;
      } | null;
      return {
        ok: false,
        code: (body?.error as GenerateErrorCode) ?? 'unknown',
        message: body?.message ?? FALLBACK_MESSAGE,
      };
    }
    return {
      ok: false,
      code: 'network',
      message: 'Sem conexão com o servidor. Verifique sua internet.',
    };
  }

  const payload = data as {
    mode: GenerateMode;
    cards: GeneratedFlashcard[] | GeneratedQuizQuestion[];
  };

  return mode === 'flashcards'
    ? { ok: true, mode, cards: payload.cards as GeneratedFlashcard[] }
    : { ok: true, mode, questions: payload.cards as GeneratedQuizQuestion[] };
}

/**
 * Converte uma questão de quiz gerada para o modelo do app: `back` é a
 * alternativa correta (ele vira o texto da opção certa no quiz, então não
 * pode carregar a explicação junto) e `quizOptions` são as erradas.
 */
export function quizQuestionToCard(q: GeneratedQuizQuestion): {
  front: string;
  back: string;
  quizOptions: string[];
} {
  const correct = q.options[q.correct_index] ?? q.options[0] ?? '';
  const wrong = q.options.filter((_, i) => i !== q.correct_index);
  return {
    front: q.question,
    back: correct,
    quizOptions: wrong.slice(0, 3),
  };
}
