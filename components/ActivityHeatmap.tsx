import React from 'react';
import { View, Text } from 'react-native';
import { format, subDays, startOfDay } from 'date-fns';
import { useThemeColors } from '@/hooks/useThemeColors';

const WEEKS = 13;
const DAYS = WEEKS * 7;
const CELL = 13;
const GAP = 3;

interface ActivityHeatmapProps {
  /** Mapa 'yyyy-MM-dd' → total de cards estudados naquele dia. */
  counts: Record<string, number>;
}

/** Intensidade 0–4 a partir da contagem de cards do dia. */
function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

export function ActivityHeatmap({ counts }: ActivityHeatmapProps) {
  const colors = useThemeColors();

  // Alinha o início ao domingo da primeira semana para as colunas baterem.
  const today = startOfDay(new Date());
  const firstDay = subDays(today, DAYS - 1);
  const leadOffset = firstDay.getDay(); // 0 = domingo
  const gridStart = subDays(firstDay, leadOffset);

  const fill = (level: number): string => {
    if (level === 0) return colors.surfaceContainerHigh;
    const opacity = [0, 0.35, 0.55, 0.8, 1][level];
    return colors.primaryContainer + alphaHex(opacity);
  };

  // Monta colunas (semanas) de 7 dias cada.
  const columns: { key: string; level: number; future: boolean }[][] = [];
  for (let w = 0; w < WEEKS + 1; w++) {
    const col: { key: string; level: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = subDays(gridStart, -(w * 7 + d));
      const key = format(day, 'yyyy-MM-dd');
      const future = day.getTime() > today.getTime();
      col.push({ key, level: levelFor(counts[key] ?? 0), future });
    }
    columns.push(col);
  }

  return (
    <View>
      <View className="flex-row" style={{ gap: GAP }}>
        {columns.map((col, ci) => (
          <View key={ci} style={{ gap: GAP }}>
            {col.map(cell => (
              <View
                key={cell.key}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 3,
                  backgroundColor: cell.future ? 'transparent' : fill(cell.level),
                }}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Legenda */}
      <View className="flex-row items-center justify-end gap-1.5 mt-3">
        <Text className="text-outline font-inter-regular text-xs">Menos</Text>
        {[0, 1, 2, 3, 4].map(l => (
          <View
            key={l}
            style={{
              width: CELL,
              height: CELL,
              borderRadius: 3,
              backgroundColor: fill(l),
            }}
          />
        ))}
        <Text className="text-outline font-inter-regular text-xs">Mais</Text>
      </View>
    </View>
  );
}

/** Converte opacidade 0–1 em sufixo hex de 2 dígitos (ex.: 0.5 → "80"). */
function alphaHex(opacity: number): string {
  const v = Math.round(Math.max(0, Math.min(1, opacity)) * 255);
  return v.toString(16).padStart(2, '0');
}
