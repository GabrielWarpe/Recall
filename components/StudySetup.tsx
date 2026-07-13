import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StudyTimerConfig, StudyTimerMode } from '@/types';
import { TIMER_LIMIT_STEPS } from '@/constants/study';
import { Button } from '@/components/ui/Button';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';

interface StudySetupProps {
  /** Nome do modo, no cabeçalho: "Estudo", "Quiz", "Escrever", "Alternado". */
  modeLabel: string;
  modeIcon: React.ComponentProps<typeof Ionicons>['name'];
  deckTitle: string;
  cardCount: number;
  /** Como chamar os itens: "questões" no quiz, "cards" nos demais. */
  itemNoun?: [singular: string, plural: string];
  /** Config desta sessão (inicializada com o padrão salvo do usuário). */
  config: StudyTimerConfig;
  onChange: (next: StudyTimerConfig) => void;
  onStart: () => void;
  onCancel: () => void;
}

const MODES: { value: StudyTimerMode; label: string; hint: string }[] = [
  { value: 'up', label: 'Crescente', hint: 'Conta o tempo que você levar.' },
  { value: 'down', label: 'Regressivo', hint: 'Conta para trás até o limite.' },
];

/**
 * Tela de início de uma sessão de estudo — a MESMA para todos os modos
 * (flashcards, alternado, quiz, escrever). Os controles vêm do padrão salvo em
 * Configurações, mas as mudanças aqui valem SÓ para esta sessão: o padrão da
 * conta não é alterado (é o que permite "hoje quero cronometrar" sem virar
 * regra).
 */
export function StudySetup({
  modeLabel,
  modeIcon,
  deckTitle,
  cardCount,
  itemNoun = ['card', 'cards'],
  config,
  onChange,
  onStart,
  onCancel,
}: StudySetupProps) {
  const colors = useThemeColors();
  const set = <K extends keyof StudyTimerConfig>(
    key: K,
    value: StudyTimerConfig[K],
  ) => onChange({ ...config, [key]: value });

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-2">
        <TouchableOpacity onPress={onCancel} className="p-2">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text
          className="flex-1 text-on-surface font-jakarta-semibold text-base text-center mr-9"
          numberOfLines={1}
        >
          {modeLabel}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Resumo */}
        <View className="items-center py-2">
          <View
            className="w-16 h-16 rounded-card items-center justify-center mb-4"
            style={{ backgroundColor: colors.primary + '22' }}
          >
            <Ionicons name={modeIcon} size={32} color={colors.primary} />
          </View>
          <Text
            className="text-on-surface font-jakarta-extrabold text-2xl text-center"
            numberOfLines={2}
          >
            {deckTitle}
          </Text>
          <Text className="text-outline font-inter-regular text-sm mt-1">
            {cardCount} {cardCount === 1 ? itemNoun[0] : itemNoun[1]}
          </Text>
        </View>

        {/* Cronômetro */}
        <View
          className="bg-surface-container rounded-card p-5 gap-4"
          style={cardShadow}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="stopwatch-outline" size={20} color={colors.primary} />
            <View className="flex-1">
              <Text className="text-on-surface font-jakarta-bold text-base">
                Cronômetro
              </Text>
              <Text className="text-outline font-inter-regular text-xs mt-0.5">
                Vale só para esta sessão
              </Text>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={v => set('enabled', v)}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
              thumbColor={config.enabled ? colors.primary : colors.outline}
            />
          </View>

          {config.enabled && (
            <>
              {/* Modo */}
              <View className="gap-2">
                <Text className="text-outline font-inter-semibold text-xs tracking-widest">
                  MODO
                </Text>
                <View className="flex-row gap-2">
                  {MODES.map(m => {
                    const active = config.mode === m.value;
                    return (
                      <TouchableOpacity
                        key={m.value}
                        onPress={() => set('mode', m.value)}
                        activeOpacity={0.8}
                        className="flex-1 rounded-card px-3 py-3 border"
                        style={{
                          backgroundColor: active
                            ? colors.primary + '1F'
                            : 'transparent',
                          borderColor: active
                            ? colors.primary
                            : colors.outlineVariant,
                        }}
                      >
                        <Text
                          className="font-inter-semibold text-sm"
                          style={{
                            color: active ? colors.primary : colors.onSurface,
                          }}
                        >
                          {m.label}
                        </Text>
                        <Text className="text-outline font-inter-regular text-xs mt-0.5 leading-4">
                          {m.hint}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Limite (só no regressivo) */}
              {config.mode === 'down' && (
                <View className="gap-2">
                  <Text className="text-outline font-inter-semibold text-xs tracking-widest">
                    TEMPO LIMITE
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {TIMER_LIMIT_STEPS.map(min => {
                      const active = config.limitSeconds === min * 60;
                      return (
                        <TouchableOpacity
                          key={min}
                          onPress={() => set('limitSeconds', min * 60)}
                          activeOpacity={0.8}
                          className="rounded-pill px-4 py-2 border"
                          style={{
                            backgroundColor: active
                              ? colors.primary + '1F'
                              : 'transparent',
                            borderColor: active
                              ? colors.primary
                              : colors.outlineVariant,
                          }}
                        >
                          <Text
                            className="font-inter-semibold text-sm"
                            style={{
                              color: active ? colors.primary : colors.onSurface,
                            }}
                          >
                            {min} min
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text className="text-outline font-inter-regular text-xs leading-4">
                    Ao zerar, você ainda termina o card em tela — a sessão
                    encerra depois dele.
                  </Text>
                </View>
              )}

              {/* Visibilidade */}
              <View className="flex-row items-center gap-3 pt-1">
                <Ionicons name="eye-outline" size={18} color={colors.outline} />
                <View className="flex-1">
                  <Text className="text-on-surface font-inter-medium text-sm">
                    Mostrar o relógio
                  </Text>
                  <Text className="text-outline font-inter-regular text-xs mt-0.5 leading-4">
                    Oculto, o tempo continua sendo medido e vai para o resultado.
                  </Text>
                </View>
                <Switch
                  value={config.visible}
                  onValueChange={v => set('visible', v)}
                  trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                  thumbColor={config.visible ? colors.primary : colors.outline}
                />
              </View>
            </>
          )}
        </View>

        <Button variant="primary" size="lg" onPress={onStart}>
          Começar
        </Button>
      </ScrollView>
    </View>
  );
}
