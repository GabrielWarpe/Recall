/**
 * Sistema de XP/nível derivado das sessões — sem coluna nova no banco.
 * 1 XP por card revisado. O custo para avançar do nível L para L+1 cresce
 * linearmente (BASE * L), então cada nível exige um pouco mais que o anterior.
 */

const BASE = 50;

export interface LevelInfo {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  progress: number; // 0..1 dentro do nível atual
}

export function levelFromXp(xp: number): LevelInfo {
  const total = Math.max(0, Math.floor(xp));
  let level = 1;
  let cumulative = 0;
  while (total >= cumulative + BASE * level) {
    cumulative += BASE * level;
    level += 1;
  }
  const xpForLevel = BASE * level;
  const xpIntoLevel = total - cumulative;
  return {
    level,
    xp: total,
    xpIntoLevel,
    xpForLevel,
    progress: xpForLevel > 0 ? xpIntoLevel / xpForLevel : 0,
  };
}

/**
 * Patentes: dão um título aspiracional a cada faixa de nível ("Estudante",
 * "Mestre"...) em vez de só um número. Cada uma tem emoji e cor própria, e a
 * próxima patente serve de meta de médio prazo — é o que dá sensação de
 * progressão e "objetivo à vista".
 */
export interface LevelTier {
  minLevel: number;
  name: string;
  emoji: string;
  color: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  { minLevel: 1, name: 'Iniciante', emoji: '🌱', color: '#10b981' },
  { minLevel: 2, name: 'Aprendiz', emoji: '📗', color: '#06b6d4' },
  { minLevel: 4, name: 'Dedicado', emoji: '⚡', color: '#3b82f6' },
  { minLevel: 7, name: 'Estudante', emoji: '🎓', color: '#8b5cf6' },
  { minLevel: 10, name: 'Erudito', emoji: '📚', color: '#f59e0b' },
  { minLevel: 15, name: 'Mestre', emoji: '🧠', color: '#f43f5e' },
  { minLevel: 20, name: 'Lenda', emoji: '👑', color: '#eab308' },
];

/** Patente atual para um dado nível. */
export function tierForLevel(level: number): LevelTier {
  let tier = LEVEL_TIERS[0]!;
  for (const t of LEVEL_TIERS) {
    if (level >= t.minLevel) tier = t;
    else break;
  }
  return tier;
}

/** Próxima patente a desbloquear (null se já está na última). */
export function nextTier(level: number): LevelTier | null {
  return LEVEL_TIERS.find(t => t.minLevel > level) ?? null;
}
