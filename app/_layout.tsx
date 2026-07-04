import { useEffect, type ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colorScheme, useColorScheme, vars } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { resolveAccent, hexToTriplet } from '@/constants/accents';
import { syncReminders } from '@/services/notifications';
import '../global.css';

void SplashScreen.preventAutoHideAsync();

// Evita um flash de tema claro antes do controlador rodar (padrão do app é escuro).
colorScheme.set('dark');

const THEME_MAP: Record<string, 'light' | 'dark' | 'system'> = {
  Claro: 'light',
  Escuro: 'dark',
  Sistema: 'system',
};

/** Aplica o tema escolhido nas configurações ao NativeWind. */
function ThemeController() {
  const { settings } = useSettings();
  useEffect(() => {
    colorScheme.set(THEME_MAP[settings.theme] ?? 'dark');
  }, [settings.theme]);
  return null;
}

/** Reagenda os lembretes locais sempre que as configs de notificação mudam. */
function NotificationController() {
  const { settings, ready } = useSettings();
  useEffect(() => {
    if (!ready) return;
    void syncReminders({
      studyReminder: settings.studyReminder,
      reminderTime: settings.reminderTime,
      streakAlert: settings.streakAlert,
    });
  }, [ready, settings.studyReminder, settings.reminderTime, settings.streakAlert]);
  return null;
}

/** StatusBar com conteúdo claro/escuro conforme o tema ativo. */
function ThemedStatusBar() {
  const { colorScheme: active } = useColorScheme();
  return <StatusBar style={active === 'light' ? 'dark' : 'light'} />;
}

const FONT_SCALE: Record<string, number> = {
  Pequeno: 0.9,
  Médio: 1,
  Grande: 1.15,
};

// Tamanhos base (escala 1.0) — espelham os defaults do global.css.
const FONT_BASE: Record<string, number> = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
};
const LEADING_BASE: Record<string, number> = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 28,
  '2xl': 32,
  '3xl': 36,
};

/**
 * Aplica COR DE DESTAQUE e TAMANHO DA FONTE sobrescrevendo as variáveis CSS
 * para toda a árvore (classes bg-primary/text-primary e text-xs…text-3xl).
 */
function ThemeVarsView({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { colorScheme: active } = useColorScheme();

  const accent = resolveAccent(settings.accent);
  const c = active === 'light' ? accent.light : accent.dark;
  const scale = FONT_SCALE[settings.fontSize] ?? 1;

  const fontVars: Record<string, string> = {};
  for (const key of Object.keys(FONT_BASE)) {
    fontVars[`--text-${key}`] = `${Math.round(FONT_BASE[key] * scale)}px`;
    fontVars[`--leading-${key}`] = `${Math.round(LEADING_BASE[key] * scale)}px`;
  }

  const style = vars({
    '--color-primary': hexToTriplet(c.primary),
    '--color-primary-container': hexToTriplet(c.primaryContainer),
    '--color-on-primary': hexToTriplet(c.onPrimary),
    '--color-on-primary-container': hexToTriplet(c.onPrimaryContainer),
    ...fontVars,
  });
  return <View style={[{ flex: 1 }, style]}>{children}</View>;
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { done: onboardingDone } = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || onboardingDone === null) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && !onboardingDone && !inOnboarding) {
      // Primeira execução autenticada: mostra o onboarding uma única vez.
      router.replace('/onboarding');
    } else if (session && onboardingDone && (inAuthGroup || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [session, loading, onboardingDone, segments, router]);

  if (loading || onboardingDone === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#d2bbff" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0b1326' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="deck/[id]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="deck/create"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="deck/edit"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="deck/add-cards"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="deck/card"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="study/[deckId]"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="achievements"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedStatusBar />
      <SettingsProvider>
        <ThemeController />
        <NotificationController />
        <ThemeVarsView>
          <AuthProvider>
            <OnboardingProvider>
              <RootNavigator />
            </OnboardingProvider>
          </AuthProvider>
        </ThemeVarsView>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
