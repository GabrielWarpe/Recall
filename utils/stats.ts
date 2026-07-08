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
