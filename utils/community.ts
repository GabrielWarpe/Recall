import type { Deck } from '@/types';
import type { CommunityDeckRow, DeckLicense } from '@/types/db';

/**
 * Regras puras de licença/proveniência da comunidade. Deck autoral (`origin`
 * null) pode tudo; cópia baixada respeita o cache de permissões da licença no
 * momento do download.
 */

export function isDownloadedCopy(deck: Deck): boolean {
  return deck.origin != null;
}

/** Exportar em arquivo / mover cards é permitido? */
export function canExport(deck: Deck): boolean {
  return deck.origin == null || deck.origin.allowExport;
}

/** Republicar na comunidade é permitido? */
export function canRepublish(deck: Deck): boolean {
  return deck.origin == null || deck.origin.allowRedistribute;
}

/** O deck publicado é uma adaptação de outro autor? (mostra "Adaptado de …"). */
export function isDerived(row: CommunityDeckRow): boolean {
  return row.original_author_id != null;
}

export interface LicensePreset {
  id: DeckLicense;
  label: string;
  emoji: string;
  hint: string;
  allowExport: boolean;
  allowRedistribute: boolean;
}

export const LICENSE_PRESETS: LicensePreset[] = [
  {
    id: 'protected',
    label: 'Protegido',
    emoji: '🔒',
    hint: 'Outros podem baixar e estudar, mas não exportar nem republicar.',
    allowExport: false,
    allowRedistribute: false,
  },
  {
    id: 'shareable',
    label: 'Compartilhável',
    emoji: '🔗',
    hint: 'Podem baixar e exportar em arquivo, mas não republicar como próprio.',
    allowExport: true,
    allowRedistribute: false,
  },
  {
    id: 'open',
    label: 'Aberto',
    emoji: '🌍',
    hint: 'Podem exportar e republicar adaptações, sempre creditando você.',
    allowExport: true,
    allowRedistribute: true,
  },
];

/** Preset de uma licença; desconhecida/null cai em 'protected' (retrocompat). */
export function presetFor(license: DeckLicense | null | undefined): LicensePreset {
  return LICENSE_PRESETS.find(p => p.id === license) ?? LICENSE_PRESETS[0]!;
}
