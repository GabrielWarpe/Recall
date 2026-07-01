import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettings {
  // Estudo
  algorithm: string;
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
  achievements: boolean;
  // Áudio
  feedbackSounds: boolean;
  tts: boolean;
  ttsLang: string;
  // Dados
  autoBackup: boolean;
  wifiOnly: boolean;
  // Acessibilidade
  highContrast: boolean;
  reduceMotion: boolean;
  swipeGestures: boolean;
  // App
  appLang: string;
}

const DEFAULTS: AppSettings = {
  algorithm: 'SM-2',
  newPerSession: 10,
  shuffle: true,
  autoReveal: false,
  theme: 'Escuro',
  accent: 'Violeta',
  fontSize: 'Médio',
  studyReminder: false,
  reminderTime: '20:00',
  streakAlert: false,
  achievements: true,
  feedbackSounds: true,
  tts: false,
  ttsLang: 'Português (BR)',
  autoBackup: true,
  wifiOnly: false,
  highContrast: false,
  reduceMotion: false,
  swipeGestures: true,
  appLang: 'Português (BR)',
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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppSettings>) });
        } catch {
          // ignora JSON corrompido e mantém os defaults
        }
      }
      setReady(true);
    });
  }, []);

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings(prev => {
        const next = { ...prev, [key]: value };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
