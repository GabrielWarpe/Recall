/**
 * Comparação tolerante de respostas digitadas (modo "Escrever").
 * Ignora caixa, acentos, pontuação e espaços extras; aceita 1 erro de
 * digitação em respostas com 5+ caracteres.
 */

export type AnswerVerdict = 'exact' | 'typo' | 'wrong';

/** Normaliza para comparação: minúsculas, sem acentos/pontuação/espaços extras. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?\u00bf\u00a1"'`\u00b4\u2019\u201c\u201d()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distância de Levenshtein clássica (inserção/remoção/substituição = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * Compara a resposta digitada com a esperada:
 * - `exact`: igual após normalização
 * - `typo`: 1 caractere de diferença numa resposta de 5+ caracteres
 * - `wrong`: o resto
 */
export function checkAnswer(input: string, expected: string): AnswerVerdict {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (a.length === 0) return 'wrong';
  if (a === b) return 'exact';
  if (b.length >= 5 && levenshtein(a, b) <= 1) return 'typo';
  return 'wrong';
}
