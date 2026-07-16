import type { GameIconName } from '@/components/icons/game/paths';
import { LEVEL_TIERS, type TierTone, type TierTreatment } from '@/utils/xp';
import { ACHIEVEMENTS } from './achievements';

/**
 * Visual de cada conquista — mapeamento 1:1: cada conquista tem sua própria
 * silhueta, nenhuma repetida (guarda em __DEV__ abaixo).
 *
 * A FAIXA dá o peso, e o cinza nunca é recompensa (é o estado bloqueado):
 *  - marco    → teal, tinta
 *  - progresso→ teal, tinta com anel
 *  - avançado → teal, preenchido
 *  - épico    → âmbar, preenchido com halo
 * As patentes (`tier_*`) espelham o emblema da própria patente.
 */

export interface AchievementVisual {
  icon: GameIconName;
  tone: TierTone;
  treatment: TierTreatment;
}

type Band = 'marco' | 'progresso' | 'avancado' | 'epico';

const BAND_VISUAL: Record<Band, { tone: TierTone; treatment: TierTreatment }> = {
  marco: { tone: 'primary', treatment: 'tint' },
  progresso: { tone: 'primary', treatment: 'ring' },
  avancado: { tone: 'primary', treatment: 'solid' },
  epico: { tone: 'tertiary', treatment: 'solid-ring' },
};

/** id → [ícone, faixa]. As patentes ficam de fora (herdam de LEVEL_TIERS). */
const ICONS: Record<string, readonly [GameIconName, Band]> = {
  // Revisões acumuladas
  cards_100: ['book-pile', 'marco'],
  cards_500: ['bookshelf', 'progresso'],
  cards_1000: ['brain', 'progresso'],
  cards_2500: ['mountaintop', 'avancado'],
  cards_5000: ['volcano', 'avancado'],
  cards_10000: ['ringed-planet', 'epico'],
  // Constância
  streak_7: ['campfire', 'marco'],
  streak_21: ['celebration-fire', 'progresso'],
  streak_50: ['fire-gem', 'avancado'],
  streak_100: ['fire-wave', 'avancado'],
  streak_365: ['sun', 'epico'],
  // Sessões
  sessions_10: ['abacus', 'marco'],
  sessions_50: ['alarm-clock', 'progresso'],
  sessions_100: ['metronome', 'progresso'],
  sessions_250: ['arena', 'avancado'],
  sessions_500: ['castle', 'epico'],
  // Maestria
  mastered_1: ['ribbon', 'marco'],
  mastered_10: ['ribbon-medal', 'marco'],
  mastered_50: ['black-belt', 'progresso'],
  mastered_250: ['gem-pendant', 'avancado'],
  mastered_1000: ['dragon-head', 'epico'],
  // Tempo de estudo (ids em segundos)
  time_3600: ['hourglass', 'marco'],
  time_36000: ['pocket-watch', 'progresso'],
  time_86400: ['stopwatch', 'avancado'],
  time_360000: ['sands-of-time', 'epico'],
  // Presença
  days_25: ['calendar', 'progresso'],
  days_100: ['oak', 'avancado'],
  days_300: ['baobab', 'epico'],
  // Precisão
  perfects_5: ['bullseye', 'progresso'],
  perfects_25: ['on-target', 'avancado'],
  perfects_50: ['trophy', 'epico'],
  // Criação
  created_50: ['quill-ink', 'marco'],
  created_250: ['papers', 'progresso'],
  created_1000: ['archive-research', 'avancado'],
  // Dedicação a um deck
  loyal_250: ['watering-can', 'progresso'],
  loyal_1000: ['fruit-tree', 'avancado'],
  // Primeiros passos
  first_deck: ['stack', 'marco'],
  first_session: ['ladder', 'marco'],
  perfect_session: ['star-medal', 'marco'],
  // Intensidade & foco
  big_session_50: ['weight-lifting-up', 'progresso'],
  big_session_100: ['dinosaur-rex', 'avancado'],
  focus_60: ['meditation', 'progresso'],
  triple_shift: ['top-hat', 'progresso'],
  sandwich: ['sandwich', 'progresso'],
  deck_tour: ['carousel', 'progresso'],
  // Precisão & superação
  rock_solid: ['moai', 'progresso'],
  hat_trick: ['soccer-ball', 'avancado'],
  comeback: ['cycle', 'progresso'],
  persistent: ['turtle', 'marco'],
  phoenix: ['egyptian-bird', 'marco'],
  reborn: ['sprout', 'progresso'],
  // Retenção & leeches
  leech_tamed: ['sea-serpent', 'progresso'],
  leech_tamed_10: ['dragon-spiral', 'avancado'],
  retention_85: ['elephant', 'avancado'],
  // Cobertura de vida
  full_week_coverage: ['compass', 'progresso'],
  full_year_months: ['solar-system', 'avancado'],
  night_15: ['moon', 'progresso'],
  dawn_15: ['sunrise', 'progresso'],
  // Modos de estudo
  all_modes: ['trident', 'marco'],
  quiz_25: ['help', 'progresso'],
  write_25: ['fountain-pen', 'progresso'],
  // Coleção & criação
  quizmaker_25: ['puzzle', 'progresso'],
  big_deck_100: ['sperm-whale', 'progresso'],
  five_solid_decks: ['brick-wall', 'progresso'],
  no_deck_behind: ['sheep', 'progresso'],
  quizified_deck: ['dart', 'avancado'],
  multimedia_deck: ['film-projector', 'progresso'],
};

/** Visual de todas as conquistas, indexado pelo id. */
export function buildAchievementVisuals(
  ids: readonly string[],
): Record<string, AchievementVisual> {
  const out: Record<string, AchievementVisual> = {};

  for (const t of LEVEL_TIERS) {
    out[`tier_${t.name.toLowerCase()}`] = {
      icon: t.icon,
      tone: t.tone,
      treatment: t.treatment,
    };
  }
  for (const [id, [icon, band]] of Object.entries(ICONS)) {
    out[id] = { icon, ...BAND_VISUAL[band] };
  }

  if (__DEV__) {
    const missing = ids.filter(id => !out[id]);
    if (missing.length > 0) {
      console.warn(`[Blink] Conquistas sem ícone: ${missing.join(', ')}`);
    }
    // Unicidade 1:1: nenhum ícone pode servir a duas conquistas.
    const used = new Map<string, string>();
    for (const id of ids) {
      const v = out[id];
      if (!v) continue;
      const owner = used.get(v.icon);
      if (owner) console.warn(`[Blink] Ícone repetido: ${v.icon} (${owner} e ${id})`);
      used.set(v.icon, id);
    }
  }
  return out;
}

if (__DEV__) {
  // Roda a validação na carga do módulo, com a lista real.
  buildAchievementVisuals(ACHIEVEMENTS.map(a => a.id));
}
