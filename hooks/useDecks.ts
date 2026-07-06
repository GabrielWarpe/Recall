import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Deck } from '@/types';
import type { SourceType } from '@/types/db';
import { db } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';

export interface NewDeckInput {
  title: string;
  emoji: string;
  color: string;
  sourceType: SourceType;
  tags?: string[];
  cards: { front: string; back: string }[];
}

export function useDecks() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setDecks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await db.decks.getAll(user.id);
      setDecks(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Recarrega sempre que a tela ganha foco (ex.: ao voltar da criação/exclusão
  // de um deck), garantindo que a lista esteja sempre atualizada.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createDeck = useCallback(
    async (input: NewDeckInput): Promise<Deck | null> => {
      if (!user) return null;
      const deck = await db.decks.create(
        user.id,
        {
          title: input.title,
          emoji: input.emoji,
          color: input.color,
          sourceType: input.sourceType,
          tags: input.tags,
        },
        input.cards,
      );
      await load();
      return deck;
    },
    [user, load],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      await db.decks.delete(id);
      await load();
    },
    [load],
  );

  return { decks, loading, createDeck, deleteDeck, reload: load };
}
