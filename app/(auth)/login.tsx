import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

function mapAuthError(message: string): string {
  if (/invalid login credentials/i.test(message))
    return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(message))
    return 'Confirme seu e-mail antes de entrar.';
  if (/network/i.test(message))
    return 'Sem conexão. Verifique sua internet.';
  return message;
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao entrar.';
      setError(mapAuthError(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-primary-container items-center justify-center mb-4">
              <Ionicons name="albums" size={32} color="#ede0ff" />
            </View>
            <Text className="text-on-surface font-jakarta-extrabold text-3xl">
              Recall
            </Text>
            <Text className="text-outline font-inter-regular text-sm mt-1">
              Entre para continuar estudando
            </Text>
          </View>

          {/* Form */}
          <View className="gap-4">
            <Input
              label="E-mail"
              placeholder="voce@email.com"
              value={email}
              onChangeText={t => {
                setEmail(t);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />

            <View className="relative">
              <Input
                label="Senha"
                placeholder="••••••••"
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                className="absolute right-3 top-9"
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.outline}
                />
              </TouchableOpacity>
            </View>

            {error != null && (
              <View className="flex-row items-center gap-2 bg-error/10 rounded-button px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text className="text-error font-inter-regular text-sm flex-1">
                  {error}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              className="self-end"
            >
              <Text className="text-primary font-inter-medium text-sm">
                Esqueci minha senha
              </Text>
            </TouchableOpacity>

            <Button
              variant="primary"
              size="lg"
              onPress={() => void handleLogin()}
              loading={loading}
            >
              Entrar
            </Button>
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-outline-variant/40" />
            <Text className="text-outline font-inter-regular text-xs mx-4">
              ou
            </Text>
            <View className="flex-1 h-px bg-outline-variant/40" />
          </View>

          <Button
            variant="outline"
            size="lg"
            onPress={() => router.push('/(auth)/register')}
          >
            Criar conta
          </Button>

          <View className="flex-row justify-center mt-6">
            <Text className="text-outline font-inter-regular text-sm">
              Novo por aqui?{' '}
            </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-inter-semibold text-sm">
                  Comece grátis
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
