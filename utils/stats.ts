import type { StudySession, StudyMode } from '@/types';

/**
 * Taxa de acerto de uma sessão: acertos ÷ (acertos + erros). Cada erro conta,
 * então um card errado duas vezes pesa dois — o número reflete o esforço real.
 *
 * A avaliação hoje é binária (acertei/errei) e `hard` é sempre 0. O campo
 * continua na conta por causa das sessões ANTIGAS, gravadas quando existia
 * "Difícil": lá ele era um acerto (o card foi lembrado, ainda que com esforço),
 * e somá-lo mantém o histórico coerente em vez de rebaixá-lo à força.
 */
export function sessionAccuracy(s: Pick<StudySession, 'correct' | 'hard' | 'again'>): number {
  const attempts = s.correct + s.hard + s.again;
  return attempts > 0 ? Math.round(((s.correct + s.hard) / attempts) * 100) : 0;
}

/** Formata segundos como "12min" ou "1h 20min" (nunca mostra segundos). */
export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/**
 * Formata segundos como relógio: "07:42", virando "1:05:09" após uma hora.
 * Diferente de `formatDuration` (leitura humana, sem segundos): aqui o valor
 * corre na tela, então cada segundo precisa aparecer.
 */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Rótulo e ícone do tipo de exercício, usados nas listas de histórico
 * (Progresso → Sessões recentes; detalhe do deck → Histórico). Mesmos ícones
 * do StudyModePicker, para o mesmo conceito ler igual em toda parte.
 */
export const STUDY_MODE_LABEL: Record<StudyMode, string> = {
  flash: 'Flashcards',
  quiz: 'Quiz',
  write: 'Escrever',
  mixed: 'Alternado',
};

// Literal (não `ComponentProps<typeof Ionicons>`) de propósito: este arquivo é
// utilitário puro, sem import de UI. Quem consome valida contra o tipo real
// de `Ionicons` no próprio JSX.
export const STUDY_MODE_ICON: Record<
  StudyMode,
  'albums' | 'help-circle' | 'create-outline' | 'shuffle'
> = {
  flash: 'albums',
  quiz: 'help-circle',
  write: 'create-outline',
  mixed: 'shuffle',
};
