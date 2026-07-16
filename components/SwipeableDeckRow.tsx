import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';

// Implementado com a API moderna (Gesture.Pan + Reanimated), a mesma do
// SwipeCard do modo estudo: os Swipeable prontos do gesture-handler quebram
// neste projeto (o Reanimated crasha no iOS com Expo 54 — issue #3720 — e o
// clássico usa a API antiga, incompatível com o wrapper JSX do NativeWind).

const ACTION_WIDTH = 84;
const GAP = 8;
/** Distância aberta ao arrastar para a DIREITA (revela Excluir). */
const LEFT_OPEN = ACTION_WIDTH + GAP;
/** Distância aberta ao arrastar para a ESQUERDA (revela Exportar/Editar). */
const RIGHT_OPEN = ACTION_WIDTH * 2 + GAP * 2;

interface SwipeableDeckRowProps {
  children: ReactNode;
  /** Arrastar para a DIREITA revela Excluir (vermelho). */
  onDelete: () => void;
  /** Arrastar para a ESQUERDA revela Exportar e Editar. */
  onExport: () => void;
  onEdit: () => void;
  /** Quando false, a ação Exportar aparece travada (cópia baixada protegida). */
  canExport?: boolean;
}

function ActionButton({
  icon,
  label,
  background,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  background: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      className="rounded-card items-center justify-center gap-1"
      style={{ width: ACTION_WIDTH, height: '100%', backgroundColor: background }}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text className="font-inter-semibold text-xs" style={{ color: tint }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Linha da lista de decks com ações por gesto: arrastar para a direita revela
 * Excluir; para a esquerda, Exportar e Editar. As ações fecham a linha antes
 * de executar.
 */
export function SwipeableDeckRow({
  children,
  onDelete,
  onExport,
  onEdit,
  canExport = true,
}: SwipeableDeckRowProps) {
  const colors = useThemeColors();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const close = () => {
    translateX.value = withTiming(0, { duration: 180 });
  };
  const run = (action: () => void) => {
    close();
    action();
  };

  const pan = Gesture.Pan()
    // Só ativa em arrasto claramente horizontal, para não roubar o scroll.
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate(e => {
      const next = startX.value + e.translationX;
      translateX.value = Math.max(-RIGHT_OPEN, Math.min(LEFT_OPEN, next));
    })
    .onEnd(() => {
      const x = translateX.value;
      if (x > LEFT_OPEN / 2) {
        translateX.value = withTiming(LEFT_OPEN, { duration: 160 });
      } else if (x < -RIGHT_OPEN / 2) {
        translateX.value = withTiming(-RIGHT_OPEN, { duration: 160 });
      } else {
        translateX.value = withTiming(0, { duration: 160 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  // As ações ficam invisíveis com a linha fechada (senão os cantos
  // arredondados do card deixariam as bordas delas aparecerem).
  const leftStyle = useAnimatedStyle(() => ({
    opacity: translateX.value > 6 ? 1 : 0,
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -6 ? 1 : 0,
  }));

  return (
    <View>
      {/* Excluir — atrás do card, lado esquerdo */}
      <Animated.View
        style={[
          leftStyle,
          { position: 'absolute', top: 0, bottom: 0, left: 0 },
        ]}
      >
        <ActionButton
          icon="trash"
          label="Excluir"
          background={colors.error}
          tint="#ffffff"
          onPress={() => run(onDelete)}
        />
      </Animated.View>

      {/* Exportar + Editar — atrás do card, lado direito */}
      <Animated.View
        style={[
          rightStyle,
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            flexDirection: 'row',
            gap: GAP,
          },
        ]}
      >
        <ActionButton
          icon={canExport ? 'share-outline' : 'lock-closed'}
          label="Exportar"
          background={colors.surfaceContainerHighest}
          tint={canExport ? colors.primary : colors.outline}
          onPress={() =>
            canExport
              ? run(onExport)
              : run(() =>
                  Alert.alert(
                    'Exportação bloqueada',
                    'Este deck foi baixado da comunidade e o autor não permite exportá-lo.',
                  ),
                )
          }
        />
        <ActionButton
          icon="pencil"
          label="Editar"
          background={colors.primaryContainer}
          tint={colors.onPrimaryContainer}
          onPress={() => run(onEdit)}
        />
      </Animated.View>

      {/* Conteúdo (o DeckCard) desliza por cima das ações */}
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
