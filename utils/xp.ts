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
