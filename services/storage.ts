import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Armazenamento LOCAL do dispositivo. Após a migração para o Supabase,
 * decks/cards/sessões/perfil vivem no banco. Aqui guardamos apenas a chave
 * da API Anthropic — um segredo do dispositivo que não deve ser sincronizado.
 */

const KEYS = {
  SETTINGS: 'recall_local_settings',
};

export interface LocalSettings {
  apiKey: string;
}

const DEFAULT_SETTINGS: LocalSettings = {
  apiKey: '',
};

export const storage = {
  async getSettings(): Promise<LocalSettings> {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(data) as Partial<LocalSettings>) }
      : { ...DEFAULT_SETTINGS };
  },

  async saveSettings(settings: Partial<LocalSettings>): Promise<void> {
    const current = await this.getSettings();
    await AsyncStorage.setItem(
      KEYS.SETTINGS,
      JSON.stringify({ ...current, ...settings }),
    );
  },
};
