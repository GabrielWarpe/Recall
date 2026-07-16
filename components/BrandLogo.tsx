import React from 'react';
import { View, Image, type ViewStyle, type StyleProp } from 'react-native';
import { useColorScheme } from 'nativewind';

// A variante clara é um wordmark de VERDADE (fundo transparente, tinta
// meia-noite) — serve pra encaixar direto sobre qualquer superfície clara.
const LOGO_LIGHT = require('@/assets/brand/blink_logo_light.png');
const LIGHT_RATIO = 1001 / 362;

// A variante "escura" NÃO é um wordmark transparente equivalente: é um selo
// autocontido — cartão arredondado preenchido com o próprio #0F1D33 da marca,
// texto claro por cima, e só as bordas arredondadas ficam transparentes.
// Colado direto sobre o fundo real do tema escuro (~#0b0f14, um pouco
// diferente), apareceria como um retângulo flutuando. Por isso ele é sempre
// envolvido num contêiner da MESMA cor exata (#0F1D33) — as duas se fundem
// numa só mancha de cor, e o conjunto lê como um selo de marca proposital,
// não uma foto mal recortada.
const LOGO_DARK = require('@/assets/brand/blink_logo_dark_1.png');
const DARK_RATIO = 1105 / 422;
const DARK_CARD_COLOR = '#0F1D33';

interface BrandLogoProps {
  /** Altura alvo, em px; a largura é derivada da proporção real do arquivo. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wordmark "Blink" — escolhe a variante clara/escura pelo tema ativo
 * (`useColorScheme` do NativeWind, mesmo hook de `useThemeColors`).
 */
export function BrandLogo({ height = 32, style }: BrandLogoProps) {
  const { colorScheme } = useColorScheme();
  const isLight = colorScheme === 'light';

  const source = isLight ? LOGO_LIGHT : LOGO_DARK;
  const ratio = isLight ? LIGHT_RATIO : DARK_RATIO;
  const width = height * ratio;

  const image = (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Blink"
      style={{ height, width }}
    />
  );

  if (isLight) {
    return <View style={style}>{image}</View>;
  }

  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: Math.round(height * 0.28),
          overflow: 'hidden',
          backgroundColor: DARK_CARD_COLOR,
        },
        style,
      ]}
    >
      {image}
    </View>
  );
}
