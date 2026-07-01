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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao enviar e-mail.';
      setError(msg);
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
          <View className="flex-row items-center mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 -ml-2 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          {sent ? (
            <View className="items-center">
              <View className="w-16 h-16 rounded-2xl bg-green-500/20 items-center justify-center mb-5">
                <Ionicons name="checkmark-circle" size={32} color="#4ade80" />
              </View>
              <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
                Link enviado!
              </Text>
              <Text className="text-outline font-inter-regular text-sm text-center mt-2 leading-5">
                Se houver uma conta vinculada a{'\n'}
                <Text className="text-on-surface font-inter-medium">
                  {email}
                </Text>
                , você receberá um link para redefinir a senha.
              </Text>
              <Button
                variant="primary"
                size="lg"
                className="mt-8 w-full"
                onPress={() => router.replace('/(auth)/login')}
              >
                Voltar para o login
              </Button>
            </View>
          ) : (
            <>
              <View className="w-14 h-14 rounded-2xl bg-primary-container items-center justify-center mb-5">
                <Ionicons name="key" size={28} color="#ede0ff" />
              </View>
              <Text className="text-on-surface font-jakarta-extrabold text-3xl">
                Recuperar senha
              </Text>
              <Text className="text-outline font-inter-regular text-sm mt-1 mb-8 leading-5">
                Digite o e-mail da sua conta e enviaremos um link para criar uma
                nova senha.
              </Text>

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
                  error={error ?? undefined}
                />

                <Button
                  variant="primary"
                  size="lg"
                  onPress={() => void handleSend()}
                  loading={loading}
                >
                  Enviar link de recuperação
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
