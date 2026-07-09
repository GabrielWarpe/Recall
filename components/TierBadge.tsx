import React from 'react';
import { View } from 'react-native';
import { TierIcon } from '@/components/icons/tiers/TierIcon';
import type { TierIconName } from '@/components/icons/tiers/paths';
import type { TierTone, TierTreatment } from '@/utils/xp';
import { useThemeColors } from '@/hooks/useThemeColors';

interface TierBadgeProps {
  icon: TierIconName;
  tone: TierTone;
  treatment: TierTreatment;
  /** Lado total do emblema, em px (inclui o halo, quando houver). */
  size?: number;
}

/** Espessura do halo + respiro até o chip, no tratamento mais alto. */
const HALO = 4;

/**
 * Emblema de uma patente: o "chip tingido" padrão do app, com a silhueta da
 * patente dentro. O peso do tratamento cresce com o nível — tinta discreta →
 * tinta com anel → preenchimento sólido → sólido com halo externo — para que a
 * raridade se leia sem precisar de sete matizes diferentes.
 */
export function TierBadge({ icon, tone, treatment, size = 64 }: TierBadgeProps) {
  const colors = useThemeColors();
  const tint = colors[tone];

  const solid = treatment === 'solid' || treatment === 'solid-ring';
  const halo = treatment === 'solid-ring';
  const chipSize = halo ? size - HALO * 2 : size;

  const chip = (
    <View
      style={{
        width: chipSize,
        height: chipSize,
        // Raio proporcional: o emblema não achata em tamanhos pequenos.
        borderRadius: Math.round(chipSize * 0.22),
        // Sólido = fundo cheio; senão, tinta baixa (o `ring` levanta um pouco).
        backgroundColor: solid ? tint : tint + (treatment === 'ring' ? '26' : '1F'),
        ...(treatment === 'ring'
          ? { borderWidth: 1, borderColor: tint + '4D' }
          : {}),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* No preenchimento sólido o glifo é vazado no fundo da tela. */}
      <TierIcon
        name={icon}
        size={Math.round(chipSize * 0.58)}
        color={solid ? colors.background : tint}
      />
    </View>
  );

  if (!halo) return chip;

  // O halo precisa ser um anel EXTERNO: uma borda semitransparente desenhada
  // sobre um fundo sólido da mesma cor simplesmente desapareceria.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        borderWidth: 2,
        borderColor: tint + '59',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {chip}
    </View>
  );
}
