import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

interface FinishPromptTarget {
  pendingFinish: number | null;
  redoUnanswered: () => void;
  leaveUnanswered: () => void;
}

/**
 * Mostra o modal de finalização quando a sessão sinaliza questões sem
 * resposta: "Refazer questões" abre a rodada só com elas; "Deixar sem
 * resposta" as marca como Puladas e vai para os resultados. Compartilhado
 * pelas telas de flashcards, quiz e escrever.
 */
export function useFinishPrompt(session: FinishPromptTarget) {
  // Guarda contra reabertura pelo mesmo sinal (re-render com o mesmo valor).
  const shownForRef = useRef<number | null>(null);

  useEffect(() => {
    const count = session.pendingFinish;
    if (count == null) {
      shownForRef.current = null;
      return;
    }
    if (shownForRef.current === count) return;
    shownForRef.current = count;

    Alert.alert(
      'Questões sem resposta',
      `Você deixou ${count} ${
        count === 1 ? 'questão' : 'questões'
      } sem resposta. O que deseja fazer?`,
      [
        { text: 'Refazer questões', onPress: () => session.redoUnanswered() },
        {
          text: 'Deixar sem resposta',
          style: 'destructive',
          onPress: () => session.leaveUnanswered(),
        },
      ],
      { cancelable: false },
    );
  }, [session.pendingFinish, session.redoUnanswered, session.leaveUnanswered]);
}
