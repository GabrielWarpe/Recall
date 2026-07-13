import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Cronômetro que conta APENAS o tempo com o app em primeiro plano.
 *
 * Três escolhas importantes:
 *  - O tempo vem de `performance.now()` (relógio monotônico), não de `Date`:
 *    mudar a hora do sistema (ou o fuso, na virada do horário de verão) não
 *    pode fazer o cronômetro pular nem andar para trás.
 *  - Ao ir para segundo plano, o trecho corrido é somado ao acumulado e o
 *    relógio para. Ao voltar, abre-se um trecho novo sobre esse acumulado —
 *    minimizar o app não infla o tempo de resolução.
 *  - O hook NÃO tem estado: ele só acumula em refs e entrega `getElapsed`.
 *    Se guardasse o tempo em `useState`, a tela dona do hook re-renderizaria a
 *    cada segundo. Quem quiser MOSTRAR o relógio tica por conta própria (ver
 *    `components/QuizTimer.tsx`), e só esse componente re-renderiza.
 */
export function useActiveTimer() {
  // Segundos já fechados (trechos anteriores de primeiro plano).
  const accumulatedRef = useRef(0);
  // Instante em que o trecho atual começou; null = parado/pausado.
  const startedAtRef = useRef<number | null>(null);
  // Distingue "pausado pelo segundo plano" de "parado/nunca iniciado": sem
  // isso, voltar ao app religaria um cronômetro já encerrado.
  const pausedRef = useRef(false);

  /** Total em segundos, incluindo o trecho em curso. */
  const getElapsed = useCallback((): number => {
    const open =
      startedAtRef.current != null
        ? (performance.now() - startedAtRef.current) / 1000
        : 0;
    return Math.floor(accumulatedRef.current + open);
  }, []);

  const start = useCallback(() => {
    accumulatedRef.current = 0;
    startedAtRef.current = performance.now();
    pausedRef.current = false;
  }, []);

  /** Congela o cronômetro e devolve o total final. */
  const stop = useCallback((): number => {
    if (startedAtRef.current != null) {
      accumulatedRef.current +=
        (performance.now() - startedAtRef.current) / 1000;
      startedAtRef.current = null;
    }
    pausedRef.current = false;
    return Math.floor(accumulatedRef.current);
  }, []);

  // Pausa/retoma conforme o app sai e volta do segundo plano. Fica sempre
  // assinado: quando o cronômetro está parado, `startedAtRef` é null e os dois
  // ramos viram no-ops.
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') {
        // Só reabre um trecho se havia um em curso antes de sair.
        if (pausedRef.current) {
          startedAtRef.current = performance.now();
          pausedRef.current = false;
        }
      } else if (startedAtRef.current != null) {
        accumulatedRef.current +=
          (performance.now() - startedAtRef.current) / 1000;
        startedAtRef.current = null;
        pausedRef.current = true;
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  return { getElapsed, start, stop };
}
