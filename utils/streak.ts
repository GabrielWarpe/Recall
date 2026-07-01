import { format } from 'date-fns';

/** Dia local no formato YYYY-MM-DD (evita o desvio de fuso do toISOString). */
function localDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Calcula a sequência de dias consecutivos de estudo a partir das datas das
 * sessões (timestamps ISO). Determinístico — sempre reflete os dados reais.
 *
 * Regra: conta dias consecutivos terminando HOJE; se hoje ainda não houve
 * estudo mas ontem houve, a sequência continua válida (contada a partir de ontem).
 */
export function computeStreak(isoDates: string[]): number {
  if (isoDates.length === 0) return 0;

  const studiedDays = new Set(isoDates.map(d => localDay(new Date(d))));
  const today = new Date();

  // Ponto de partida: hoje (se estudou hoje) ou ontem (se não, mas estudou ontem).
  let cursor = today;
  if (!studiedDays.has(localDay(today))) {
    cursor = addDays(today, -1);
    if (!studiedDays.has(localDay(cursor))) return 0;
  }

  let streak = 0;
  while (studiedDays.has(localDay(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Maior sequência de dias consecutivos já alcançada (recorde). */
export function computeLongestStreak(isoDates: string[]): number {
  if (isoDates.length === 0) return 0;

  // Dias distintos ordenados cronologicamente (YYYY-MM-DD ordena lexicograficamente).
  const days = [...new Set(isoDates.map(d => localDay(new Date(d))))].sort();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    // Datas YYYY-MM-DD viram meia-noite UTC para ambas — diff exata em dias.
    const diff = Math.round(
      (new Date(days[i]!).getTime() - new Date(days[i - 1]!).getTime()) /
        86_400_000,
    );
    run = diff === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}
