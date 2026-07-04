import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { db } from './database';
import { DECK_COLORS } from '@/constants/theme';
import type { Deck } from '@/types';

/**
 * Exportação/importação de baralhos em um único arquivo JSON portátil.
 * Guardamos apenas o essencial (nome, emoji, cor e os pares frente/verso);
 * ao importar, cada baralho é recriado com o progresso SM-2 zerado.
 */

interface DeckExport {
  title: string;
  emoji: string;
  color: string;
  cards: { front: string; back: string }[];
}

interface BackupFile {
  app: 'Recall';
  version: number;
  exportedAt: string;
  decks: DeckExport[];
}

export interface BackupResult {
  deckCount: number;
  cardCount: number;
}

/** Erro com código estável para a UI decidir a mensagem exibida. */
export class BackupError extends Error {
  constructor(public code: 'EMPTY' | 'INVALID' | 'NO_CARDS') {
    super(code);
    this.name = 'BackupError';
  }
}

/** Transforma um baralho do app no formato enxuto do backup. */
function toDeckExport(d: Deck): DeckExport {
  return {
    title: d.title,
    emoji: d.emoji,
    color: d.color,
    cards: d.cards.map(c => ({ front: c.front, back: c.back })),
  };
}

/** Reduz um título a um nome de arquivo seguro (ascii, sem espaços). */
function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'baralho'
  );
}

/** Escreve o JSON no cache e abre a folha de compartilhamento do sistema. */
async function shareDecks(
  decks: Deck[],
  fileBase: string,
  dialogTitle: string,
): Promise<BackupResult> {
  const payload: BackupFile = {
    app: 'Recall',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks: decks.map(toDeckExport),
  };
  const cardCount = payload.decks.reduce((sum, d) => sum + d.cards.length, 0);

  // Extensão própria `.recall` + tipo de documento genérico: assim apps como o
  // WhatsApp tratam como ANEXO de arquivo, não como texto colado na mensagem.
  // (JSON marcado como public.json herda de "texto puro" e vira corpo da msg.)
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

  return { deckCount: payload.decks.length, cardCount };
}

/**
 * Exporta TODOS os baralhos do usuário em um único arquivo e abre a folha de
 * compartilhamento (salvar em Arquivos, enviar, etc.).
 */
export async function exportDecks(userId: string): Promise<BackupResult> {
  const decks = await db.decks.getAll(userId);
  if (decks.length === 0) throw new BackupError('EMPTY');
  const stamp = new Date().toISOString().slice(0, 10);
  return shareDecks(
    decks,
    `recall-baralhos-${stamp}`,
    'Exportar baralhos do Recall',
  );
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

/**
 * Abre o seletor de arquivos, lê um backup JSON e recria os baralhos válidos.
 * Retorna `null` se o usuário cancelar a seleção.
 */
export async function importDecks(userId: string): Promise<BackupResult | null> {
  // Aceita qualquer arquivo: os backups têm extensão própria `.recall` (mas
  // arquivos `.json` antigos também funcionam — o conteúdo é sempre JSON).
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset) return null;

  let parsed: unknown;
  try {
    const raw = await new File(asset.uri).text();
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError('INVALID');
  }

  const decks = (parsed as Partial<BackupFile>)?.decks;
  if (!Array.isArray(decks)) throw new BackupError('INVALID');

  let deckCount = 0;
  let cardCount = 0;

  for (const d of decks) {
    const title = typeof d?.title === 'string' ? d.title.trim() : '';
    const cards = Array.isArray(d?.cards)
      ? d.cards
          .filter(
            c =>
              c &&
              typeof c.front === 'string' &&
              typeof c.back === 'string' &&
              c.front.trim().length > 0,
          )
          .map(c => ({ front: String(c.front), back: String(c.back) }))
      : [];

    if (!title || cards.length === 0) continue;

    await db.decks.create(
      userId,
      {
        title,
        emoji: typeof d.emoji === 'string' && d.emoji ? d.emoji : '📚',
        color:
          typeof d.color === 'string' && d.color ? d.color : DECK_COLORS[0],
        sourceType: 'file',
      },
      cards,
    );
    deckCount++;
    cardCount += cards.length;
  }

  if (deckCount === 0) throw new BackupError('NO_CARDS');
  return { deckCount, cardCount };
}
