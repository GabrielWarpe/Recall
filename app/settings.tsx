import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Linking,
  Share,
  TextInput,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { db } from '@/services/database';
import { ensureNotificationPermission } from '@/services/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { TimePickerRow } from '@/components/settings/TimePickerRow';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function SettingsScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const { user, profile, signOut, sendPasswordReset, refreshProfile } =
    useAuth();
  const { settings, update } = useSettings();
  const colors = useThemeColors();

  // Meta diária vive no perfil (Supabase); editada inline aqui.
  const [dailyGoal, setDailyGoal] = useState('20');
  useEffect(() => {
    if (profile) setDailyGoal(String(profile.daily_goal));
  }, [profile]);

  const saveDailyGoal = async () => {
    if (!user) return;
    const goal = Math.max(1, parseInt(dailyGoal, 10) || 20);
    setDailyGoal(String(goal));
    await db.profile.update(user.id, { daily_goal: goal });
    await refreshProfile();
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const pickOption = (
    title: string,
    options: string[],
    onSelect: (o: string) => void,
  ) => {
    Alert.alert(title, undefined, [
      ...options.map(o => ({ text: o, onPress: () => onSelect(o) })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  const soon = () =>
    Alert.alert('Em breve', 'Esta funcionalidade estará disponível em breve.');

  // Ao ativar uma notificação, garante a permissão antes de salvar a opção.
  const toggleNotification = async (
    key: 'studyReminder' | 'streakAlert' | 'achievements',
    value: boolean,
  ) => {
    if (value) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert(
          'Permissão necessária',
          'Ative as notificações do Recall nas configurações do sistema para receber lembretes.',
        );
        return;
      }
    }
    update(key, value);
  };

  const handleShare = () => {
    void Share.share({
      message:
        'Estude com flashcards e IA no Recall! Memorize qualquer coisa de forma inteligente. 🧠',
    }).catch(() => undefined);
  };

  const handleAbout = () => {
    Alert.alert(
      'Recall',
      `Versão ${APP_VERSION}\n\nApp de flashcards com criação assistida por IA.\nFeito com Expo + Supabase.`,
    );
  };

  const handleChangePassword = () => {
    if (!user?.email) return;
    Alert.alert(
      'Alterar senha',
      `Enviaremos um link de redefinição para ${user.email}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              await sendPasswordReset(user.email!);
              Alert.alert(
                'E-mail enviado',
                'Verifique sua caixa de entrada para redefinir a senha.',
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Erro ao enviar.';
              Alert.alert('Erro', msg);
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sair da conta', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Esta ação é permanente e remove todos os seus decks e dados. Para prosseguir, entre em contato com o suporte.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Falar com suporte',
          style: 'destructive',
          onPress: () =>
            void Linking.openURL(
              'mailto:suporte@recall.app?subject=Exclus%C3%A3o%20de%20conta',
            ).catch(soon),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-3 pt-2 pb-3 border-b border-outline-variant/15">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text className="flex-1 text-on-surface font-jakarta-bold text-lg ml-1">
          Configurações
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Conta ── */}
        <SettingsSection title="Conta">
          <SettingsRow
            icon="person-circle"
            iconColor={colors.primary}
            title={profile?.name ?? 'Minha conta'}
            subtitle={user?.email ?? undefined}
          />
          <SettingsRow
            icon="key"
            iconColor="#ffb690"
            title="Alterar senha"
            onPress={handleChangePassword}
          />
        </SettingsSection>

        {/* ── Estudo ── */}
        <SettingsSection title="Estudo">
          <SettingsRow
            icon="repeat"
            iconColor={colors.primary}
            title="Algoritmo de repetição"
            value={settings.algorithm}
            onPress={() =>
              pickOption('Algoritmo', ['SM-2', 'FSRS', 'Básico'], v =>
                update('algorithm', v),
              )
            }
          />
          <SettingsRow
            icon="flag"
            iconColor="#ffb690"
            title="Meta diária de cartões"
            rightSlot={
              <TextInput
                value={dailyGoal}
                onChangeText={setDailyGoal}
                onEndEditing={() => void saveDailyGoal()}
                keyboardType="number-pad"
                returnKeyType="done"
                className="text-on-surface font-inter-semibold text-base w-14 text-right"
                selectionColor={colors.primary}
              />
            }
          />
          <SettingsRow
            icon="add-circle"
            iconColor="#9ef0b0"
            title="Novos cartões por sessão"
            value={String(settings.newPerSession)}
            onPress={() =>
              pickOption('Novos por sessão', ['5', '10', '15', '20', '30'], v =>
                update('newPerSession', parseInt(v, 10)),
              )
            }
          />
          <SettingsRow
            icon="shuffle"
            iconColor={colors.primary}
            title="Embaralhar cartões"
            toggle={{
              value: settings.shuffle,
              onValueChange: v => update('shuffle', v),
            }}
          />
          <SettingsRow
            icon="eye"
            iconColor="#ffb690"
            title="Mostrar resposta automática"
            toggle={{
              value: settings.autoReveal,
              onValueChange: v => update('autoReveal', v),
            }}
          />
        </SettingsSection>

        {/* ── Aparência ── */}
        <SettingsSection title="Aparência">
          <SettingsRow
            icon="contrast"
            iconColor={colors.primary}
            title="Tema"
            subtitle={
              settings.theme === 'Sistema'
                ? `Sistema (${scheme === 'light' ? 'claro' : 'escuro'})`
                : undefined
            }
            value={settings.theme}
            onPress={() =>
              pickOption('Tema', ['Claro', 'Escuro', 'Sistema'], v =>
                update('theme', v),
              )
            }
          />
          <SettingsRow
            icon="color-palette"
            iconColor="#ffb690"
            title="Cor de destaque"
            value={settings.accent}
            onPress={() =>
              pickOption(
                'Cor de destaque',
                ['Violeta', 'Azul', 'Verde', 'Laranja', 'Rosa'],
                v => update('accent', v),
              )
            }
          />
          <SettingsRow
            icon="text"
            iconColor="#7cc6ff"
            title="Tamanho da fonte"
            value={settings.fontSize}
            onPress={() =>
              pickOption('Tamanho da fonte', ['Pequeno', 'Médio', 'Grande'], v =>
                update('fontSize', v),
              )
            }
          />
        </SettingsSection>

        {/* ── Notificações ── */}
        <SettingsSection title="Notificações">
          <SettingsRow
            icon="notifications"
            iconColor="#ffb690"
            title="Lembrete de estudo"
            subtitle={
              settings.studyReminder
                ? `Todos os dias às ${settings.reminderTime}`
                : undefined
            }
            toggle={{
              value: settings.studyReminder,
              onValueChange: v => void toggleNotification('studyReminder', v),
            }}
          />
          {settings.studyReminder && (
            <TimePickerRow
              value={settings.reminderTime}
              onChange={v => update('reminderTime', v)}
            />
          )}
          <SettingsRow
            icon="flame"
            iconColor="#ff8a65"
            title="Alerta de sequência"
            subtitle={settings.streakAlert ? 'Todos os dias às 21:00' : undefined}
            toggle={{
              value: settings.streakAlert,
              onValueChange: v => void toggleNotification('streakAlert', v),
            }}
          />
          <SettingsRow
            icon="trophy"
            iconColor="#ffd479"
            title="Conquistas"
            subtitle="Avise quando desbloquear marcos"
            toggle={{
              value: settings.achievements,
              onValueChange: v => void toggleNotification('achievements', v),
            }}
          />
        </SettingsSection>

        {/* ── Áudio ── */}
        <SettingsSection title="Áudio e tato">
          <SettingsRow
            icon="phone-portrait"
            iconColor={colors.primary}
            title="Feedback tátil (vibração)"
            toggle={{
              value: settings.feedbackSounds,
              onValueChange: v => update('feedbackSounds', v),
            }}
          />
          <SettingsRow
            icon="volume-high"
            iconColor="#7cc6ff"
            title="Text-to-speech"
            toggle={{ value: settings.tts, onValueChange: v => update('tts', v) }}
          />
          <SettingsRow
            icon="language"
            iconColor="#9ef0b0"
            title="Idioma do TTS"
            value={settings.ttsLang}
            onPress={() =>
              pickOption(
                'Idioma do TTS',
                ['Português (BR)', 'English (US)', 'Español'],
                v => update('ttsLang', v),
              )
            }
          />
        </SettingsSection>

        {/* ── Dados ── */}
        <SettingsSection title="Dados">
          <SettingsRow
            icon="cloud-upload"
            iconColor="#7cc6ff"
            title="Backup automático"
            toggle={{
              value: settings.autoBackup,
              onValueChange: v => update('autoBackup', v),
            }}
          />
          <SettingsRow
            icon="download"
            iconColor="#9ef0b0"
            title="Exportar baralhos"
            onPress={() =>
              pickOption('Exportar como', ['.apkg', 'CSV', 'JSON'], () => soon())
            }
          />
          <SettingsRow
            icon="cloud-download"
            iconColor={colors.primary}
            title="Importar baralhos"
            onPress={soon}
          />
          <SettingsRow
            icon="wifi"
            iconColor="#ffb690"
            title="Baixar apenas no Wi-Fi"
            toggle={{
              value: settings.wifiOnly,
              onValueChange: v => update('wifiOnly', v),
            }}
          />
        </SettingsSection>

        {/* ── Acessibilidade ── */}
        <SettingsSection title="Acessibilidade">
          <SettingsRow
            icon="contrast-outline"
            iconColor={colors.primary}
            title="Alto contraste"
            toggle={{
              value: settings.highContrast,
              onValueChange: v => update('highContrast', v),
            }}
          />
          <SettingsRow
            icon="pause-circle"
            iconColor="#ffb690"
            title="Reduzir animações"
            toggle={{
              value: settings.reduceMotion,
              onValueChange: v => update('reduceMotion', v),
            }}
          />
          <SettingsRow
            icon="hand-left"
            iconColor="#7cc6ff"
            title="Gestos de swipe"
            subtitle="Desligado: avalie só pelos botões"
            toggle={{
              value: settings.swipeGestures,
              onValueChange: v => update('swipeGestures', v),
            }}
          />
        </SettingsSection>

        {/* ── App ── */}
        <SettingsSection title="App">
          <SettingsRow
            icon="globe"
            iconColor="#7cc6ff"
            title="Idioma do app"
            value={settings.appLang}
            onPress={() =>
              pickOption(
                'Idioma do app',
                ['Português (BR)', 'English (US)', 'Español'],
                v => update('appLang', v),
              )
            }
          />
          <SettingsRow
            icon="star"
            iconColor="#ffd479"
            title="Avaliar o app"
            onPress={soon}
          />
          <SettingsRow
            icon="share-social"
            iconColor={colors.primary}
            title="Compartilhar app"
            onPress={handleShare}
          />
          <SettingsRow
            icon="help-circle"
            iconColor="#9ef0b0"
            title="Central de ajuda"
            onPress={soon}
          />
          <SettingsRow
            icon="chatbox-ellipses"
            iconColor="#ffb690"
            title="Enviar feedback"
            onPress={() =>
              void Linking.openURL(
                'mailto:suporte@recall.app?subject=Feedback',
              ).catch(soon)
            }
          />
          <SettingsRow
            icon="document-text"
            iconColor={colors.outline}
            title="Termos de uso"
            onPress={soon}
          />
          <SettingsRow
            icon="shield-checkmark"
            iconColor={colors.outline}
            title="Política de privacidade"
            onPress={soon}
          />
          <SettingsRow
            icon="information-circle"
            iconColor="#7cc6ff"
            title="Sobre"
            value={`v${APP_VERSION}`}
            onPress={handleAbout}
          />
        </SettingsSection>

        {/* ── Footer ── */}
        <View className="gap-4 mt-2">
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.8}
            className="bg-error/15 rounded-card py-3.5 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text className="text-error font-inter-semibold text-base">
              Sair da conta
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDeleteAccount} className="items-center">
            <Text className="text-outline font-inter-regular text-sm underline">
              Excluir conta
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-outline font-inter-regular text-xs text-center mt-6">
          Recall v{APP_VERSION}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
