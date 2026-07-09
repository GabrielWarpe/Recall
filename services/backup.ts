import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths, readAsStringAsync } from 'expo-file-system';
import { db } from './database';
import { DECK_COLORS } from '@/constants/theme';
import type { Deck, Flashcard } from '@/types';

/**
 * Exportação/importação de baralhos e cartões em arquivos `.recall` (JSON).
 * Dois formatos, distinguidos na leitura:
 *  - Backup de baralho: `{ decks: [...] }` (cada deck traz um `id` estável).
 *  - Pacote de cartões: `{ type: 'cards', cards: [...] }` — para compartilhar
 *    apenas alguns cartões e adicioná-los a um baralho na importação.
 * Ao recriar, o progresso SM-2 sempre nasce zerado.
 */

const APP = 'Recall' as const;
const VERSION = 2;

interface CardExport {
  front: string;
  back: string;
  images?: string[];
}

interface DeckExport {
  /** uuid estável do deck (ausente em backups antigos → conflito por nome). */
  id?: string;
  title: string;
  emoji: string;
  color: string;
  /** URL pública da capa (opcional). */
  coverUrl?: string | null;
  tags?: string[];
  cards: CardExport[];
}

interface DeckBackupFile {
  app: typeof APP;
  version: number;
  exportedAt: string;
  decks: DeckExport[];
}

interface CardBundleFile {
  app: typeof APP;
  version: number;
  exportedAt: string;
  type: 'cards';
  source: { title: string; emoji: string } | null;
  cards: CardExport[];
}

export interface BackupResult {
  deckCount: number;
  cardCount: number;
}

/** Erro com código estável para a UI decidir a mensagem exibida. */
export class BackupError extends Error {
  constructor(public code: 'EMPTY' | 'INVALID' | 'NO_CARDS' | 'READ') {
    super(code);
    this.name = 'BackupError';
  }
}

// ── Tipos do fluxo de importação ─────────────────────────────────────────────

export interface ImportCard {
  front: string;
  back: string;
  images?: string[];
}

export interface ImportDeck {
  id: string | null;
  title: string;
  emoji: string;
  color: string;
  coverUrl: string | null;
  tags: string[];
  cards: ImportCard[];
}

export type ParsedBackup =
  | { kind: 'decks'; decks: ImportDeck[] }
  | {
      kind: 'cards';
      cards: ImportCard[];
      source: { title: string; emoji: string } | null;
    };

export interface DeckConflict {
  deck: ImportDeck;
  existingId: string;
  existingTitle: string;
}

export interface ImportPlan {
  /** Decks sem correspondência — importados sem perguntar. */
  newDecks: ImportDeck[];
  /** Decks que já existem na conta — o usuário decide o que fazer. */
  conflicts: DeckConflict[];
}

export type ConflictAction = 'copy' | 'skip' | 'replace';

/** Destino de um pacote de cartões importado. */
export type CardImportTarget =
  | { type: 'existing'; deckId: string }
  | { type: 'new'; title: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function toCardExport(c: Pick<Flashcard, 'front' | 'back' | 'images'>): CardExport {
  return {
    front: c.front,
    back: c.back,
    ...(c.images.length > 0 ? { images: c.images } : {}),
  };
}

function toDeckExport(d: Deck): DeckExport {
  return {
    id: d.id,
    title: d.title,
    emoji: d.emoji,
    color: d.color,
    ...(d.coverUrl ? { coverUrl: d.coverUrl } : {}),
    tags: d.tags,
    cards: d.cards.map(toCardExport),
  };
}

function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'baralho'
  );
}

const normTitle = (s: string): string => s.trim().toLowerCase();

/** Escreve o payload no cache e abre a folha de compartilhamento do sistema. */
async function sharePayload(
  payload: DeckBackupFile | CardBundleFile,
  fileBase: string,
  dialogTitle: string,
): Promise<void> {
  // Extensão própria `.recall` + tipo genérico: apps como o WhatsApp tratam
  // como ANEXO de arquivo, não como texto colado na mensagem.
  const file = new File(Paths.cache, `${fileBase}.recall`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle,
      UTI: 'public.data',
    });
  }
}

// ── Exportação ────────────────────────────────────────────────────────────────

async function shareDecks(
  decks: Deck[],
  fileBase: string,
  dialogTitle: string,
): Promise<BackupResult> {
  const payload: DeckBackupFile = {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    decks: decks.map(toDeckExport),
  };
  const cardCount = payload.decks.reduce((sum, d) => sum + d.cards.length, 0);
  await sharePayload(payload, fileBase, dialogTitle);
  return { deckCount: payload.decks.length, cardCount };
}

/** Exporta TODOS os baralhos do usuário num único arquivo. */
export async function exportDecks(userId: string): Promise<BackupResult> {
  const decks = await db.decks.getAll(userId);
  if (decks.length === 0) throw new BackupError('EMPTY');
  const stamp = new Date().toISOString().slice(0, 10);
  return shareDecks(decks, `recall-baralhos-${stamp}`, 'Exportar baralhos do Recall');
}

/** Exporta um único baralho já carregado. */
export async function exportDeck(deck: Deck): Promise<BackupResult> {
  if (deck.cards.length === 0) throw new BackupError('EMPTY');
  const stamp = new Date().toISOString().slice(0, 10);
  return shareDecks(
    [deck],
    `recall-${slugify(deck.title)}-${stamp}`,
    `Exportar "${deck.title}"`,
  );
}

/** Exporta apenas os cartões selecionados como um "pacote de cartões". */
export async function exportCards(
  deck: Pick<Deck, 'title' | 'emoji'>,
  cards: Flashcard[],
): Promise<BackupResult> {
  if (cards.length === 0) throw new BackupError('EMPTY');
  const payload: CardBundleFile = {
    app: APP,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    type: 'cards',
    source: { title: deck.title, emoji: deck.emoji },
    cards: cards.map(toCardExport),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  await sharePayload(
    payload,
    `recall-cartoes-${slugify(deck.title)}-${stamp}`,
    `Exportar ${cards.length} ${cards.length === 1 ? 'cartão' : 'cartões'}`,
  );
  return { deckCount: 0, cardCount: cards.length };
}

// ── Leitura e parsing ──────────────────────────────────────────────────────────

/** Abre o seletor de arquivos e devolve o conteúdo cru; null se cancelar. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  // Leitura em duas tentativas: API nova (File) e, se falhar, a legada —
  // alguns provedores de arquivo (WhatsApp/Drive) entregam URIs que só uma abre.
  try {
    return await new File(asset.uri).text();
  } catch {
    try {
      return await readAsStringAsync(asset.uri);
    } catch {
      throw new BackupError('READ');
    }
  }
}

function normalizeCards(raw: unknown): ImportCard[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is { front: string; back: string; images?: unknown } =>
        c != null &&
        typeof c.front === 'string' &&
        typeof c.back === 'string' &&
        c.front.trim().length > 0,
    )
    .map(c => {
      const images = Array.isArray(c.images)
        ? c.images
            .filter(
              (u): u is string => typeof u === 'string' && /^https?:\/\//.test(u),
            )
            .slice(0, 4)
        : [];
      return {
        front: String(c.front),
        back: String(c.back),
        ...(images.length > 0 ? { images } : {}),
      };
    });
}

function normalizeDeck(d: {
  id?: unknown;
  title?: unknown;
  emoji?: unknown;
  color?: unknown;
  coverUrl?: unknown;
  tags?: unknown;
  cards?: unknown;
}): ImportDeck {
  const tags = Array.isArray(d.tags)
    ? d.tags
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .slice(0, 5)
    : [];
  return {
    id: typeof d.id === 'string' && d.id.length > 0 ? d.id : null,
    title: typeof d.title === 'string' ? d.title.trim() : '',
    emoji: typeof d.emoji === 'string' && d.emoji ? d.emoji : '📚',
    color: typeof d.color === 'string' && d.color ? d.color : DECK_COLORS[0]!,
    coverUrl:
      typeof d.coverUrl === 'string' && /^https?:\/\//.test(d.coverUrl)
        ? d.coverUrl
        : null,
    tags,
    cards: normalizeCards(d.cards),
  };
}

/** Interpreta o JSON cru como backup de baralho ou pacote de cartões. */
export function parseBackup(raw: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError('INVALID');
  }
  const obj = parsed as {
    type?: unknown;
    cards?: unknown;
    decks?: unknown;
    source?: { title?: unknown; emoji?: unknown } | null;
  } | null;

  // Pacote de cartões: `type:'cards'` ou tem `cards[]` sem `decks[]`.
  if (obj?.type === 'cards' || (Array.isArray(obj?.cards) && !Array.isArray(obj?.decks))) {
    const cards = normalizeCards(obj?.cards);
    if (cards.length === 0) throw new BackupError('NO_CARDS');
    const src = obj?.source;
    const source =
      src && typeof src.title === 'string' && src.title
        ? {
            title: String(src.title),
            emoji: typeof src.emoji === 'string' && src.emoji ? src.emoji : '📚',
          }
        : null;
    return { kind: 'cards', cards, source };
  }

  // Backup de baralho.
  if (!Array.isArray(obj?.decks)) throw new BackupError('INVALID');
  const decks = (obj.decks as unknown[])
    .map(d => normalizeDeck(d as Parameters<typeof normalizeDeck>[0]))
    .filter(d => d.title.length > 0 && d.cards.length > 0);
  if (decks.length === 0) throw new BackupError('NO_CARDS');
  return { kind: 'decks', decks };
}

// ── Plano e aplicação (baralhos) ────────────────────────────────────────────────

/** Classifica cada deck importado como novo ou em conflito com um existente. */
export function buildImportPlan(
  existing: { id: string; title: string }[],
  decks: ImportDeck[],
): ImportPlan {
  const byId = new Map(existing.map(e => [e.id, e]));
  const byName = new Map(existing.map(e => [normTitle(e.title), e]));
  const newDecks: ImportDeck[] = [];
  const conflicts: DeckConflict[] = [];

  for (const d of decks) {
    const match = d.id ? byId.get(d.id) : byName.get(normTitle(d.title));
    if (match) {
      conflicts.push({ deck: d, existingId: match.id, existingTitle: match.title });
    } else {
      newDecks.push(d);
    }
  }
  return { newDecks, conflicts };
}

/** Gera um título único do tipo "Nome (2)" evitando os já usados. */
function uniqueTitle(base: string, taken: Set<string>): string {
  if (!taken.has(normTitle(base))) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(normTitle(candidate))) return candidate;
  }
}

async function createDeck(userId: string, deck: ImportDeck, title: string): Promise<void> {
  await db.decks.create(
    userId,
    {
      title,
      emoji: deck.emoji,
      color: deck.color,
      coverUrl: deck.coverUrl,
      sourceType: 'file',
      tags: deck.tags,
    },
    deck.cards,
  );
}

/** Aplica a importação de baralhos: novos + conflitos resolvidos. */
export async function applyDeckImport(
  userId: string,
  opts: {
    newDecks: ImportDeck[];
    resolutions: { deck: ImportDeck; existingId: string; action: ConflictAction }[];
    existingTitles: string[];
  },
): Promise<BackupResult> {
  const taken = new Set(opts.existingTitles.map(normTitle));
  let deckCount = 0;
  let cardCount = 0;

  const importNew = async (deck: ImportDeck, title: string) => {
    await createDeck(userId, deck, title);
    taken.add(normTitle(title));
    deckCount++;
    cardCount += deck.cards.length;
  };

  for (const deck of opts.newDecks) {
    await importNew(deck, uniqueTitle(deck.title, taken));
  }

  for (const { deck, existingId, action } of opts.resolutions) {
    if (action === 'skip') continue;
    if (action === 'replace') {
      await db.decks.delete(existingId);
      // O título do existente deixa de contar como "usado".
      await importNew(deck, deck.title);
    } else {
      // copy
      await importNew(deck, uniqueTitle(deck.title, taken));
    }
  }

  return { deckCount, cardCount };
}

// ── Aplicação (pacote de cartões) ───────────────────────────────────────────────

/** Adiciona os cartões importados a um deck existente ou a um deck novo. */
export async function applyCardImport(
  userId: string,
  target: CardImportTarget,
  cards: ImportCard[],
): Promise<BackupResult> {
  if (cards.length === 0) throw new BackupError('NO_CARDS');
  if (target.type === 'existing') {
    await db.decks.addCards(userId, target.deckId, cards);
    return { deckCount: 0, cardCount: cards.length };
  }
  await db.decks.create(
    userId,
    {
      title: target.title,
      emoji: '📚',
      color: DECK_COLORS[0]!,
      sourceType: 'file',
      tags: [],
    },
    cards,
  );
  return { deckCount: 1, cardCount: cards.length };
}
