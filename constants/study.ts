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

// ── Cronômetro regressivo (vale para todos os modos de estudo) ───────────────

/** Limite de tempo padrão, em minutos. */
export const TIMER_LIMIT_DEFAULT_MIN = 10;

/** Opções de limite oferecidas na tela de início (minutos). */
export const TIMER_LIMIT_STEPS = [5, 10, 15, 20, 30, 45, 60] as const;

/** Faixa aceita para o limite, em minutos. */
export const TIMER_LIMIT_MIN = 1;
export const TIMER_LIMIT_MAX = 120;

/** Restringe um limite de tempo (minutos) à faixa permitida. */
export function clampTimerLimit(minutes: number): number {
  if (Number.isNaN(minutes)) return TIMER_LIMIT_DEFAULT_MIN;
  return Math.min(
    TIMER_LIMIT_MAX,
    Math.max(TIMER_LIMIT_MIN, Math.round(minutes)),
  );
}

/** Restando isto ou menos, o relógio entra em alerta (âmbar). */
export const TIMER_WARN_SECONDS = 60;

/** Restando isto ou menos, o relógio entra em perigo (vermelho). */
export const TIMER_DANGER_SECONDS = 10;
