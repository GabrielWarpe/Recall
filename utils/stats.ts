import type { StudySession } from '@/types';

/**
 * Taxa de acerto real de uma sessão: Bom/Fácil E Difícil contam como acerto
 * (o card foi lembrado, ainda que com esforço) — só "De novo" é erro.
 * Contar Difícil como erro subestimava a taxa mostrada ao usuário.
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
