import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Controla a experiência de primeira execução. A flag vive no dispositivo
 * (AsyncStorage) — é intencionalmente local, não sincronizada: o onboarding é
 * sobre apresentar o app neste aparelho, não um dado da conta.
 */

const STORAGE_KEY = 'recall_onboarding_done';

interface OnboardingContextType {
  /** `null` enquanto carrega; depois `true`/`false`. */
  done: boolean | null;
  complete: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  done: null,
  complete: () => undefined,
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then(v => setDone(v === '1'));
  }, []);

  const complete = useCallback(() => {
    setDone(true);
    void AsyncStorage.setItem(STORAGE_KEY, '1');
  }, []);

  return (
    <OnboardingContext.Provider value={{ done, complete }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
