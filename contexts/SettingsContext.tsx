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
import { TIMER_LIMIT_DEFAULT_MIN } from '@/constants/study';
import type { StudyTimerMode } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export interface AppSettings {
  // Estudo
  shuffle: boolean;
  autoReveal: boolean;
  // Cronômetro das sessões de estudo — vale para TODOS os modos (flashcards,
  // alternado, quiz, escrever). É o padrão da conta; a tela de início permite
  // trocar só para aquela sessão, sem mexer nestes valores.
  studyTimer: boolean;
  studyTimerMode: StudyTimerMode;
  studyTimerMinutes: number;
  studyTimerVisible: boolean;
  // Aparência
  theme: string;
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

// Os defaults do cronômetro reproduzem o comportamento anterior (ligado,
// crescente, visível): quem já usava o app não percebe mudança nenhuma.
const DEFAULTS: AppSettings = {
  shuffle: true,
  autoReveal: false,
  studyTimer: true,
  studyTimerMode: 'up',
  studyTimerMinutes: TIMER_LIMIT_DEFAULT_MIN,
  studyTimerVisible: true,
  theme: 'Escuro',
  fontSize: 'Médio',
  studyReminder: false,
  reminderTime: '20:00',
  streakAlert: false,
  feedbackSounds: true,
  reduceMotion: false,
  swipeGestures: true,
};

const STORAGE_KEY = 'recall_app_settings';
/** Marca que o cache local tem mudanças que ainda não chegaram ao banco. */
const DIRTY_KEY = 'recall_settings_dirty';

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

/**
 * O cronômetro nasceu só no quiz (`quizTimer*`) e depois passou a valer para
 * todas as sessões (`studyTimer*`). Quem já tinha a preferência antiga salva
 * não pode perdê-la — as chaves legadas são traduzidas na leitura, e só
 * preenchem o que ainda não existe no formato novo.
 */
const LEGACY_KEYS: Record<string, keyof AppSettings> = {
  quizTimer: 'studyTimer',
  quizTimerMode: 'studyTimerMode',
  quizTimerMinutes: 'studyTimerMinutes',
  quizTimerVisible: 'studyTimerVisible',
};

function migrateLegacy(raw: Record<string, unknown>): Partial<AppSettings> {
  const s = { ...raw } as Record<string, unknown>;
  for (const [old, next] of Object.entries(LEGACY_KEYS)) {
    if (old in s) {
      if (!(next in s)) s[next] = s[old];
      delete s[old];
    }
  }
  return s as Partial<AppSettings>;
}

/** O JSONB do banco ainda guarda alguma chave do formato antigo? */
function hasLegacyKeys(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object') return false;
  return Object.keys(raw).some(k => k in LEGACY_KEYS);
}

function parseSettings(raw: string | null): Partial<AppSettings> | null {
  if (!raw) return null;
  try {
    return migrateLegacy(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null; // JSON corrompido → ignora
  }
}

/**
 * Grava as configurações no banco. Se falhar (sem rede, coluna `settings`
 * ausente, RLS…), marca o local como SUJO em vez de engolir o erro: assim a
 * próxima abertura sabe que o banco está atrasado e não deixa o valor velho
 * sobrescrever a escolha do usuário.
 */
async function pushSettings(
  userId: string,
  value: Partial<AppSettings>,
): Promise<void> {
  const dirtyKey = `${DIRTY_KEY}:${userId}`;
  try {
    await db.profile.update(userId, {
      settings: value as Record<string, unknown>,
    });
    await AsyncStorage.removeItem(dirtyKey);
  } catch (e) {
    await AsyncStorage.setItem(dirtyKey, '1');
    if (__DEV__) {
      console.warn(
        '[Blink/settings] NÃO salvou no banco (vale só neste aparelho). ' +
          'Confira se `profiles.settings` (jsonb) existe e se o RLS permite UPDATE. Erro:',
        (e as { message?: string } | null)?.message ?? e,
      );
    }
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
    const dirtyKey = `${DIRTY_KEY}:${userId}`;
    void (async () => {
      // 1) Cache local do PRÓPRIO usuário: abre rápido com o último estado.
      const cached = parseSettings(await AsyncStorage.getItem(cacheKey));
      if (cancelled) return;
      if (cached) setSettings({ ...DEFAULTS, ...cached });
      setReady(true);

      // Há mudanças locais que NUNCA chegaram ao banco? Então o banco está
      // desatualizado e não pode mandar — senão ele desfaz o que o usuário
      // acabou de escolher (era exatamente o bug: a preferência revertia ao
      // reabrir o app).
      const dirty = (await AsyncStorage.getItem(dirtyKey)) === '1';

      // 2) O banco é a fonte da verdade — exceto quando o local está sujo.
      const profile = await db.profile.get(userId);
      if (cancelled) return;
      // O JSONB do banco também pode trazer as chaves legadas do cronômetro.
      const remote = migrateLegacy(
        (profile?.settings ?? {}) as Record<string, unknown>,
      );
      const hasRemote = Object.keys(remote).length > 0;

      if (dirty && cached) {
        // Local vence e tenta ressincronizar (o banco reaparece, a coluna é
        // criada, a rede volta…).
        setSettings({ ...DEFAULTS, ...cached });
        await pushSettings(userId, cached);
      } else if (hasRemote) {
        const merged = { ...DEFAULTS, ...remote };
        setSettings(merged);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(remote));
        // Se o banco ainda guardava as chaves legadas, grava a versão já
        // traduzida — senão elas ficariam lá para sempre.
        if (hasLegacyKeys(profile?.settings)) await pushSettings(userId, remote);
      } else if (profile) {
        // Conta ainda sem configurações no banco: migra as preferências que
        // existiam neste aparelho (cache novo ou chave legada global).
        const legacy =
          cached ?? parseSettings(await AsyncStorage.getItem(STORAGE_KEY));
        if (cancelled) return;
        if (legacy) {
          setSettings({ ...DEFAULTS, ...legacy });
          await AsyncStorage.setItem(cacheKey, JSON.stringify(legacy));
          await pushSettings(userId, legacy);
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
          // O cache é escrito SEMPRE e na hora; o banco é tentado em seguida.
          // Se a escrita remota falhar, `pushSettings` marca o local como sujo
          // e a próxima abertura do app repete a tentativa.
          void AsyncStorage.setItem(
            `${STORAGE_KEY}:${userId}`,
            JSON.stringify(next),
          );
          void pushSettings(userId, next);
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
