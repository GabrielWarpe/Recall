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

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const colors = useThemeColors();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = 'Informe seu nome.';
    if (!email.trim()) next.email = 'Informe seu e-mail.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'E-mail inválido.';
    if (!password) next.password = 'Crie uma senha.';
    else if (password.length < 6)
      next.password = 'A senha deve ter ao menos 6 caracteres.';
    if (confirm !== password) next.confirm = 'As senhas não coincidem.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const hasSession = await signUp(email.trim(), password, name.trim());
      if (hasSession) {
        // Confirmação de e-mail desativada: sessão já criada → entra direto.
        router.replace('/(tabs)');
      } else {
        // Confirmação ligada: orienta o usuário a abrir o e-mail.
        setSuccess(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar conta.';
      const friendly = /already registered|already exists/i.test(msg)
        ? 'Este e-mail já está cadastrado.'
        : msg;
      setErrors({ form: friendly });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View className="w-16 h-16 rounded-2xl bg-green-500/20 items-center justify-center mb-5">
          <Ionicons name="mail-unread" size={32} color="#4ade80" />
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Confirme seu e-mail
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2 leading-5">
          Enviamos um link de confirmação para{'\n'}
          <Text className="text-on-surface font-inter-medium">{email}</Text>.
          {'\n'}Abra-o para ativar sua conta.
        </Text>
        <Button
          variant="primary"
          size="lg"
          className="mt-8 w-full"
          onPress={() => router.replace('/(auth)/login')}
        >
          Ir para o login
        </Button>
      </SafeAreaView>
    );
  }

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
          {/* Header */}
          <View className="flex-row items-center mb-8">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 -ml-2 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <Text className="text-on-surface font-jakarta-extrabold text-3xl">
            Criar conta
          </Text>
          <Text className="text-outline font-inter-regular text-sm mt-1 mb-8">
            Comece a memorizar de verdade
          </Text>

          <View className="gap-4">
            <Input
              label="Nome completo"
              placeholder="Seu nome"
              value={name}
              onChangeText={t => {
                setName(t);
                setErrors(e => ({ ...e, name: undefined }));
              }}
              autoCapitalize="words"
              error={errors.name}
            />
            <Input
              label="E-mail"
              placeholder="voce@email.com"
              value={email}
              onChangeText={t => {
                setEmail(t);
                setErrors(e => ({ ...e, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={errors.email}
            />

            <View className="relative">
              <Input
                label="Senha"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setErrors(e => ({ ...e, password: undefined }));
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                error={errors.password}
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

            <Input
              label="Confirmar senha"
              placeholder="Repita a senha"
              value={confirm}
              onChangeText={t => {
                setConfirm(t);
                setErrors(e => ({ ...e, confirm: undefined }));
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              error={errors.confirm}
            />

            {errors.form != null && (
              <View className="flex-row items-center gap-2 bg-error/10 rounded-button px-3 py-2.5">
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text className="text-error font-inter-regular text-sm flex-1">
                  {errors.form}
                </Text>
              </View>
            )}

            <Button
              variant="primary"
              size="lg"
              className="mt-2"
              onPress={() => void handleRegister()}
              loading={loading}
            >
              Criar conta
            </Button>
          </View>

          <View className="flex-row justify-center mt-6">
            <Text className="text-outline font-inter-regular text-sm">
              Já tenho conta.{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text className="text-primary font-inter-semibold text-sm">
                Entrar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
