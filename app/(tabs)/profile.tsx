import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db } from '@/services/database';
import { ensureNotificationPermission } from '@/services/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useStreak } from '@/hooks/useStreak';
import { useThemeColors } from '@/hooks/useThemeColors';
import { GoalSlider } from '@/components/GoalSlider';
import { ACHIEVEMENTS, getUnlocked } from '@/services/achievements';

const GOAL_MIN = 10;
const GOAL_MAX = 150;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { settings, update } = useSettings();
  const { streak } = useStreak();
  const colors = useThemeColors();

  const name = profile?.name ?? 'Estudante';
  const initial = (name.trim()[0] ?? 'R').toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).getFullYear()
    : null;

  // Meta diária editada pelo slider; persiste no perfil ao soltar.
  const [goal, setGoal] = useState(profile?.daily_goal ?? 20);
  useEffect(() => {
    if (profile) setGoal(profile.daily_goal);
  }, [profile]);

  const commitGoal = async (v: number) => {
    if (!user) return;
    await db.profile.update(user.id, { daily_goal: v });
    await refreshProfile();
  };

  // ── Edição de nome ─────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const openEditName = () => {
    setNameDraft(profile?.name ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!user || trimmed.length === 0) {
      setEditingName(false);
      return;
    }
    try {
      await db.profile.update(user.id, { name: trimmed });
      await refreshProfile();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o nome.');
    }
    setEditingName(false);
  };

  // ── Troca de foto ──────────────────────────────────────────────────────────
  const [savingAvatar, setSavingAvatar] = useState(false);

  const pickAvatar = async () => {
    if (!user || savingAvatar) return;
    // No iOS a galeria usa o PHPicker (não exige permissão de biblioteca).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    setSavingAvatar(true);
    try {
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      await db.profile.update(user.id, { avatar_url: dataUri });
      await refreshProfile();
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar a foto.');
    } finally {
      setSavingAvatar(false);
    }
  };

  // Cards dominados + conquistas; recarrega ao focar a aba.
  const [mastered, setMastered] = useState(0);
  const [achievementsCount, setAchievementsCount] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void db.flashcards.countMastered(user.id).then(setMastered);
      void getUnlocked().then(ids => setAchievementsCount(ids.length));
    }, [user]),
  );

  const toggleNotifications = async (value: boolean) => {
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
    update('studyReminder', value);
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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — único acesso às configurações */}
        <View className="flex-row items-center justify-between mb-8">
          <Text className="text-on-surface font-jakarta-extrabold text-2xl">
            Perfil
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            className="w-10 h-10 items-center justify-center rounded-xl bg-surface-container"
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>

        {/* Avatar com anel + nome */}
        <View className="items-center">
          <TouchableOpacity
            onPress={pickAvatar}
            activeOpacity={0.85}
            disabled={savingAvatar}
            className="relative"
          >
            <View
              className="rounded-full p-1"
              style={{ borderWidth: 3, borderColor: colors.primary }}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-primary-container items-center justify-center">
                  <Text className="text-on-primary-container font-jakarta-extrabold text-4xl">
                    {initial}
                  </Text>
                </View>
              )}
            </View>
            {/* Badge de câmera */}
            <View
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-container items-center justify-center"
              style={{ borderWidth: 2, borderColor: colors.background }}
            >
              <Ionicons
                name="camera"
                size={15}
                color={colors.onPrimaryContainer}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openEditName}
            activeOpacity={0.7}
            className="flex-row items-center gap-1.5 mt-4"
          >
            <Text className="text-on-surface font-jakarta-extrabold text-2xl">
              {name}
            </Text>
            <Ionicons name="pencil" size={16} color={colors.outline} />
          </TouchableOpacity>
          {memberSince != null && (
            <Text className="text-outline font-inter-medium text-sm mt-1">
              Membro desde {memberSince}
            </Text>
          )}
        </View>

        {/* Stat tiles */}
        <View className="flex-row gap-4 mt-8">
          <View className="flex-1 bg-surface-container rounded-card p-5 items-center border border-outline-variant/20">
            <Ionicons name="flame" size={28} color={colors.tertiary} />
            <Text className="text-on-surface font-jakarta-extrabold text-3xl mt-2">
              {streak}
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-1">
              Dias de sequência
            </Text>
          </View>
          <View className="flex-1 bg-surface-container rounded-card p-5 items-center border border-outline-variant/20">
            <Ionicons name="medal" size={28} color={colors.primary} />
            <Text className="text-on-surface font-jakarta-extrabold text-3xl mt-2">
              {mastered}
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-1">
              Cards dominados
            </Text>
          </View>
        </View>

        {/* Meta diária */}
        <View className="bg-surface-container rounded-card p-5 border border-outline-variant/20 mt-4">
          <View className="flex-row items-end justify-between">
            <Text className="text-on-surface font-jakarta-bold text-xl">
              Meta diária
            </Text>
            <Text className="text-primary font-jakarta-extrabold text-2xl">
              {goal}
              <Text className="text-primary font-inter-regular text-sm"> cards</Text>
            </Text>
          </View>
          <View className="mt-3">
            <GoalSlider
              value={goal}
              min={GOAL_MIN}
              max={GOAL_MAX}
              onChange={setGoal}
              onCommit={v => void commitGoal(v)}
              trackColor={colors.surfaceContainerHighest}
              fillColor={colors.primary}
              thumbColor={colors.primary}
            />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-outline font-inter-regular text-xs">
              {GOAL_MIN}
            </Text>
            <Text className="text-outline font-inter-medium text-xs">Casual</Text>
            <Text className="text-outline font-inter-medium text-xs">Intenso</Text>
            <Text className="text-outline font-inter-regular text-xs">
              {GOAL_MAX}
            </Text>
          </View>
        </View>

        {/* Notificações push */}
        <View className="flex-row items-center gap-3 px-4 py-3.5 bg-surface-container rounded-card border border-outline-variant/20 mt-4">
          <View className="w-10 h-10 rounded-xl items-center justify-center bg-surface-container-high">
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-on-surface font-inter-medium text-[15px]">
              Notificações push
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              Lembrete diário de estudo
            </Text>
          </View>
          <Switch
            value={settings.studyReminder}
            onValueChange={v => void toggleNotifications(v)}
            trackColor={{
              false: colors.surfaceContainerHighest,
              true: colors.primaryContainer,
            }}
            thumbColor={colors.onPrimaryContainer}
            ios_backgroundColor={colors.surfaceContainerHighest}
          />
        </View>

        {/* Conquistas */}
        <TouchableOpacity
          onPress={() => router.push('/achievements')}
          activeOpacity={0.8}
          className="flex-row items-center gap-3 px-4 py-3.5 bg-surface-container rounded-card border border-outline-variant/20 mt-4"
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center bg-surface-container-high">
            <Ionicons name="trophy-outline" size={20} color={colors.tertiary} />
          </View>
          <View className="flex-1">
            <Text className="text-on-surface font-inter-medium text-[15px]">
              Conquistas
            </Text>
            <Text className="text-outline font-inter-regular text-xs mt-0.5">
              {achievementsCount} de {ACHIEVEMENTS.length} desbloqueadas
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.outline} />
        </TouchableOpacity>

        {/* Sair */}
        <TouchableOpacity
          onPress={handleSignOut}
          className="items-center mt-8"
          activeOpacity={0.7}
        >
          <Text className="text-error font-inter-semibold text-base">
            Sair da conta
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal: editar nome */}
      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-8">
          <View className="w-full bg-surface-container-high rounded-card p-5">
            <Text className="text-on-surface font-jakarta-bold text-lg mb-3">
              Editar nome
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Seu nome"
              placeholderTextColor={colors.outline}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => void saveName()}
              className="bg-surface-container rounded-button px-4 py-3 text-on-surface font-inter-regular text-base"
              selectionColor={colors.primary}
            />
            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setEditingName(false)}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-button items-center bg-surface-container"
              >
                <Text className="text-outline font-inter-semibold">
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void saveName()}
                activeOpacity={0.8}
                className="flex-1 py-3 rounded-button items-center bg-primary-container"
              >
                <Text className="text-on-primary-container font-inter-semibold">
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
