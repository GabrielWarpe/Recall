import type { TierIconName } from '@/components/icons/tiers/paths';

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
 * "Mestre"...) em vez de só um número, e a próxima serve de meta de médio
 * prazo — é o que dá sensação de progressão e "objetivo à vista".
 *
 * A cor NÃO é um hex fixo: é uma chave da paleta (`tone`), resolvida pelo tema
 * em tempo de render. Assim as patentes acompanham claro/escuro e a cor de
 * destaque, em vez de carregarem cores de fora do sistema.
 *
 * A progressão é lida em dois eixos: o matiz esfria→esquenta (neutro → azul →
 * teal → âmbar) e o `treatment` ganha peso (tinta → anel → preenchimento).
 */

/** Chaves da paleta usadas pelas patentes. */
export type TierTone = 'outline' | 'info' | 'primary' | 'tertiary';

/** Peso visual do emblema, crescente. */
export type TierTreatment = 'tint' | 'ring' | 'solid' | 'solid-ring';

export interface LevelTier {
  minLevel: number;
  name: string;
  icon: TierIconName;
  tone: TierTone;
  treatment: TierTreatment;
}

// `name` e `minLevel` são intocáveis: o id das conquistas de patente é
// derivado do nome (`tier_${name.toLowerCase()}`) e já está persistido.
export const LEVEL_TIERS: LevelTier[] = [
  { minLevel: 1, name: 'Iniciante', icon: 'sprout', tone: 'outline', treatment: 'tint' },
  { minLevel: 2, name: 'Aprendiz', icon: 'open-book', tone: 'info', treatment: 'tint' },
  { minLevel: 4, name: 'Dedicado', icon: 'flame', tone: 'primary', treatment: 'tint' },
  { minLevel: 7, name: 'Estudante', icon: 'owl', tone: 'primary', treatment: 'ring' },
  { minLevel: 10, name: 'Erudito', icon: 'quill', tone: 'tertiary', treatment: 'ring' },
  { minLevel: 15, name: 'Mestre', icon: 'laurels', tone: 'tertiary', treatment: 'solid' },
  { minLevel: 20, name: 'Lenda', icon: 'crown', tone: 'tertiary', treatment: 'solid-ring' },
];

/** XP total acumulado necessário para ALCANÇAR um nível (nível 1 = 0 XP). */
export function xpForLevelStart(level: number): number {
  const n = Math.max(0, Math.floor(level) - 1);
  // Soma de BASE * (1 + 2 + … + n): custo de todos os níveis anteriores.
  return (BASE * n * (n + 1)) / 2;
}

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
