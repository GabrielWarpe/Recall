import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/services/database';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Controla a experiência de primeira execução. A flag é um dado DA CONTA
 * (`profiles.onboarding_done`): uma conta nova vê o onboarding mesmo num
 * aparelho já usado, e uma conta antiga não o revê ao trocar de aparelho.
 * As chaves antigas do AsyncStorage (global e por usuário) são migradas para
 * o banco uma única vez.
 */

const LEGACY_STORAGE_KEY = 'recall_onboarding_done';
const LEGACY_KEY_PREFIX = 'recall_onboarding_done_';

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
  const { user, profile, refreshProfile } = useAuth();
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Deslogado: valor irrelevante para as rotas (vão para o login), mas não
    // pode ficar `null` senão o app trava no spinner.
    if (!user) {
      setDone(false);
      return;
    }
    if (!profile) {
      setDone(null); // perfil ainda carregando
      return;
    }
    if (profile.onboarding_done) {
      setDone(true);
      return;
    }

    // Conta marcada como "não viu": se este aparelho tem alguma flag legada
    // (global ou por usuário — o usuário já viu o onboarding antes da
    // migração para o banco), sobe para a conta.
    void (async () => {
      const [legacyGlobal, legacyPerUser] = await Promise.all([
        AsyncStorage.getItem(LEGACY_STORAGE_KEY),
        AsyncStorage.getItem(LEGACY_KEY_PREFIX + user.id),
      ]);
      if (cancelled) return;
      if (legacyGlobal === '1' || legacyPerUser === '1') {
        setDone(true);
        await db.profile
          .update(user.id, { onboarding_done: true })
          // Migração única: remove as flags do aparelho para que contas NOVAS
          // criadas aqui vejam o onboarding normalmente.
          .then(() =>
            AsyncStorage.multiRemove([
              LEGACY_STORAGE_KEY,
              LEGACY_KEY_PREFIX + user.id,
            ]),
          )
          .catch(() => undefined);
      } else {
        setDone(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile]);

  const complete = useCallback(() => {
    setDone(true);
    if (user) {
      void db.profile
        .update(user.id, { onboarding_done: true })
        .then(() => refreshProfile())
        .catch(() => undefined);
    }
  }, [user?.id, refreshProfile]);

  return (
    <OnboardingContext.Provider value={{ done, complete }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
