/**
 * Limites da meta diária de cartões. Ficam num só lugar para o slider do
 * Perfil e o campo das Configurações concordarem — antes o Perfil travava em
 * 150 mas o campo de Configurações aceitava qualquer número.
 */
export const GOAL_MIN = 10;
export const GOAL_MAX = 150;

/** Restringe um valor de meta ao intervalo permitido. */
export function clampGoal(value: number): number {
  if (Number.isNaN(value)) return GOAL_MIN;
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(value)));
}

/** Opacidade de uma alternativa riscada (eliminada) no quiz. */
export const STRUCK_OPACITY = 0.45;

/** Intervalo de atualização do cronômetro do quiz. */
export const TIMER_TICK_MS = 1000;
