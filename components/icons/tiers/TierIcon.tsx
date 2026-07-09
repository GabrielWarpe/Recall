import React from 'react';
import Svg, { Path } from 'react-native-svg';
import {
  TIER_ICON_PATHS,
  TIER_ICON_VIEWBOX,
  type TierIconName,
} from './paths';

interface TierIconProps {
  name: TierIconName;
  /** Lado do quadrado, em px. */
  size: number;
  color: string;
}

/** Desenha a silhueta de uma patente, tingida pela cor recebida. */
export function TierIcon({ name, size, color }: TierIconProps) {
  return (
    <Svg width={size} height={size} viewBox={TIER_ICON_VIEWBOX}>
      <Path d={TIER_ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}

export { type TierIconName };
