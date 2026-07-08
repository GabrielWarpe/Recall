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

export interface AppSettings {
  // Estudo
  newPerSession: number;
  shuffle: boolean;
  autoReveal: boolean;
  // Aparência
  theme: string;
  accent: string;
  fontSize: string;
  // Notificações
  studyReminder: boolean;
  reminderTime: string; // "HH:MM"
  streakAlert: boolean;
  // Feedback
  feedbackSounds: boolean;
  // Acessibilidade
  reduceMotion: boolean;
  swipeGestures: boolean;
}

const DEFAULTS: AppSettings = {
  newPerSession: 10,
  shuffle: true,
  autoReveal: false,
  theme: 'Escuro',
  accent: 'Teal',
  fontSize: 'Médio',
  studyReminder: false,
  reminderTime: '20:00',
  streakAlert: false,
  feedbackSounds: true,
  reduceMotion: false,
  swipeGestures: true,
};

const STORAGE_KEY = 'recall_app_settings';

interface SettingsContextType {
  settings: AppSettings;
  ready: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULTS,
  ready: false,
  update: () => undefined,
});

function parseSettings(raw: string | null): Partial<AppSettings> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return null; // JSON corrompido → ignora
  }
}

/**
 * As configurações são um dado DA CONTA: vivem em `profiles.settings` no
 * Supabase. O AsyncStorage vira apenas um cache local por usuário
 * (`recall_app_settings:<userId>`) para o app abrir com o tema certo antes
 * de a rede responder — nunca é compartilhado entre contas.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      // Deslogado: defaults (telas de auth só precisam do tema padrão).
      setSettings(DEFAULTS);
      setReady(true);
      return;
    }

    const cacheKey = `${STORAGE_KEY}:${userId}`;
    void (async () => {
      // 1) Cache local do PRÓPRIO usuário: abre rápido com o último estado.
      const cached = parseSettings(await AsyncStorage.getItem(cacheKey));
      if (cancelled) return;
      if (cached) setSettings({ ...DEFAULTS, ...cached });
      setReady(true);

      // 2) Fonte da verdade: o banco. Sobrescreve o cache ao responder.
      const profile = await db.profile.get(userId);
      if (cancelled) return;
      const remote = (profile?.settings ?? {}) as Partial<AppSettings>;

      if (Object.keys(remote).length > 0) {
        setSettings({ ...DEFAULTS, ...remote });
        await AsyncStorage.setItem(cacheKey, JSON.stringify(remote));
      } else if (profile) {
        // Conta ainda sem configurações no banco: migra as preferências que
        // existiam neste aparelho (cache novo ou chave legada global).
        const legacy =
          cached ?? parseSettings(await AsyncStorage.getItem(STORAGE_KEY));
        if (cancelled) return;
        if (legacy) {
          setSettings({ ...DEFAULTS, ...legacy });
          await AsyncStorage.setItem(cacheKey, JSON.stringify(legacy));
          await db.profile
            .update(userId, {
              settings: legacy as Record<string, unknown>,
            })
            .catch(() => undefined); // sem rede/coluna: o cache local segura
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(prev => {
        const next = { ...prev, [key]: value };
        if (userId) {
          void AsyncStorage.setItem(
            `${STORAGE_KEY}:${userId}`,
            JSON.stringify(next),
          );
          void db.profile
            .update(userId, {
              settings: next as unknown as Record<string, unknown>,
            })
            .catch(() => undefined); // offline: o cache local preserva; sincroniza na próxima escrita
        }
        return next;
      });
    },
    [userId],
  );

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
