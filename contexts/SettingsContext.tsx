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
