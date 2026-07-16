import React from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LICENSE_PRESETS, presetFor } from '@/utils/community';
import type { DeckLicense } from '@/types/db';
import { useThemeColors } from '@/hooks/useThemeColors';

interface PublishToggleProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  license: DeckLicense;
  onLicenseChange: (l: DeckLicense) => void;
  /** Quando setado, o toggle fica travado (ex.: cópia baixada sem permissão). */
  lockedReason?: string | null;
}

/**
 * Interruptor "Publicar na comunidade" + seletor de licença. Ligado, o deck
 * vira um snapshot público; a licença define o que quem baixa pode fazer
 * (estudar / exportar / republicar com crédito).
 */
export function PublishToggle({
  value,
  onValueChange,
  license,
  onLicenseChange,
  lockedReason,
}: PublishToggleProps) {
  const colors = useThemeColors();
  const locked = lockedReason != null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View
          className="w-10 h-10 rounded-button items-center justify-center"
          style={{ backgroundColor: colors.primary + '22' }}
        >
          <Ionicons
            name={locked ? 'lock-closed' : 'earth'}
            size={20}
            color={locked ? colors.outline : colors.primary}
          />
        </View>
        <View className="flex-1">
          <Text className="text-on-surface font-inter-semibold text-[15px]">
            Publicar na comunidade
          </Text>
          <Text className="text-outline font-inter-regular text-xs mt-0.5 leading-4">
            {locked
              ? lockedReason
              : 'Outros usuários poderão encontrar e baixar este deck.'}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={locked}
          trackColor={{ false: colors.surfaceContainerHighest, true: colors.primary }}
          thumbColor="#ffffff"
        />
      </View>

      {value && !locked && (
        <View className="gap-2">
          <Text className="text-on-surface-variant font-inter-medium text-sm">
            Quem baixar pode:
          </Text>
          <View className="flex-row gap-2">
            {LICENSE_PRESETS.map(p => {
              const active = license === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => onLicenseChange(p.id)}
                  activeOpacity={0.8}
                  className={`flex-1 items-center py-2.5 rounded-card border ${
                    active
                      ? 'bg-primary-container border-primary'
                      : 'bg-surface-container border-outline-variant'
                  }`}
                >
                  <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                  <Text
                    className={`font-inter-semibold text-xs mt-1 ${
                      active ? 'text-on-primary-container' : 'text-outline'
                    }`}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text className="text-outline font-inter-regular text-xs leading-4">
            {presetFor(license).hint}
          </Text>
          <Text className="text-outline font-inter-regular text-xs leading-4">
            Publique apenas conteúdo seu ou de uso livre.
          </Text>
        </View>
      )}
    </View>
  );
}
