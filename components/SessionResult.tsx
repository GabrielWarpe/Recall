import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressRing } from '@/components/ProgressRing';
import { formatClock } from '@/utils/stats';
import { useThemeColors } from '@/hooks/useThemeColors';

interface SessionResultProps {
  deckTitle: string;
  /** Entendi. */
  correct: number;
  /** Não deu. */
  wrong: number;
  /** Pulou. */
  skipped: number;
  /** Tempo total (segundos); some se `showTime` for false. */
  seconds: number;
  showTime: boolean;
  /** Nº de cards para "praticar as que não entendi" (errou ou pulou). */
  redoCount: number;
  /** Acurácia (%) da sessão anterior deste deck; null se for a 1ª (sem âncora). */
  priorPct?: number | null;
  onRedo: (scope: 'all' | 'wrong') => void;
  onExit: () => void;
  onAchievements?: () => void;
}

/** Tempo curto ("29 s") ou relógio ("2:05") — como no NotebookLM. */
function shortTime(seconds: number): string {
  return seconds < 60 ? `${seconds} s` : formatClock(seconds);
}

/**
 * Tela de resultado de uma sessão — estilo NotebookLM: um anel com
 * Entendi/total no centro, a legenda dos três desfechos (Entendi / Não deu /
 * Pulou) e "Praticar de novo", que abre a escolha entre todas ou só as que
 * não entendi. Usada por flashcards, quiz e escrever.
 */
export function SessionResult({
  deckTitle,
  correct,
  wrong,
  skipped,
  seconds,
  showTime,
  redoCount,
  priorPct,
  onRedo,
  onExit,
  onAchievements,
}: SessionResultProps) {
  const colors = useThemeColors();
  const [menuOpen, setMenuOpen] = useState(false);

  const total = correct + wrong + skipped;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Ancoragem/Contraste: o cérebro avalia relativo. Em vez de só o número
  // absoluto, mostrar o delta contra a última sessão deste deck.
  const delta = priorPct != null ? pct - priorPct : null;
  const deltaTint =
    delta == null || delta === 0
      ? colors.outline
      : delta > 0
        ? colors.success
        : colors.error;
  const deltaLabel =
    delta == null
      ? null
      : delta === 0
        ? 'igual à sua última sessão'
        : `${delta > 0 ? '▲ +' : '▼ '}${delta}% vs. sua última sessão`;

  // "6/55" cabe grande; "1000/2000" precisa encolher para não vazar do anel.
  const ringChars = `${correct}/${total}`.length;
  const ringFontSize = ringChars <= 5 ? 36 : ringChars <= 7 ? 28 : 22;

  // Título encorajador, calibrado pelo aproveitamento.
  const headline =
    pct >= 80
      ? 'Mandou muito bem!'
      : pct >= 40
        ? 'Bom trabalho — siga assim'
        : 'Você consegue da próxima vez';

  const RING = 168;

  return (
    <View className="flex-1 px-6 justify-center">
      <View
        className="rounded-card p-6"
        style={{ backgroundColor: colors.surfaceContainer }}
      >
        <Text className="text-on-surface font-jakarta-extrabold text-2xl text-center leading-8">
          {headline}
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-1">
          {deckTitle}
        </Text>

        {deltaLabel != null && (
          <Text
            className="font-inter-semibold text-sm text-center mt-2"
            style={{ color: deltaTint }}
          >
            {deltaLabel}
          </Text>
        )}

        <View
          className="rounded-card mt-5 p-5 flex-row items-center justify-between"
          style={{ backgroundColor: colors.surfaceContainerHigh }}
        >
          {/* Anel Entendi/total */}
          <View style={{ width: RING, height: RING }}>
            <ProgressRing
              progress={total > 0 ? correct / total : 0}
              size={RING}
              strokeWidth={12}
              color={colors.success}
            />
            <View
              className="items-center justify-center px-3"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Text
                className="text-on-surface font-jakarta-extrabold"
                // Fonte encolhe conforme o texto cresce (decks grandes); a
                // largura tabular mantém tudo alinhado. `adjustsFontSizeToFit`
                // é a rede de segurança para o caso extremo.
                style={{
                  fontSize: ringFontSize,
                  lineHeight: ringFontSize + 2,
                  fontVariant: ['tabular-nums'],
                }}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {correct}/{total}
              </Text>
              <Text className="text-on-surface font-jakarta-bold text-base mt-0.5">
                {pct}%
              </Text>
              {showTime && (
                <Text className="text-outline font-inter-regular text-sm mt-0.5">
                  {shortTime(seconds)}
                </Text>
              )}
            </View>
          </View>

          {/* Legenda: total + os três desfechos. A % de acerto é sobre o
              TOTAL (puladas contam contra). */}
          <View className="gap-3 pl-2">
            <LegendRow label="Total" value={total} color={colors.onSurface} />
            <LegendRow label="Acertos" value={correct} color={colors.success} />
            <LegendRow label="Erros" value={wrong} color={colors.error} />
            <LegendRow label="Puladas" value={skipped} color={colors.onSurface} />
          </View>
        </View>
      </View>

      {/* Praticar de novo (abre a escolha) */}
      <View className="mt-5">
        {!menuOpen ? (
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.85}
            className="rounded-3xl h-14 flex-row items-center justify-center gap-2 border"
            style={{ borderColor: colors.outlineVariant }}
          >
            <Text className="text-on-surface font-jakarta-bold text-base">
              Praticar de novo
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.onSurface} />
          </TouchableOpacity>
        ) : (
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => onRedo('all')}
              activeOpacity={0.85}
              className="rounded-3xl h-14 items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text
                className="font-jakarta-bold text-base"
                style={{ color: colors.background }}
              >
                Todas ({total})
              </Text>
            </TouchableOpacity>
            {redoCount > 0 && (
              <TouchableOpacity
                onPress={() => onRedo('wrong')}
                activeOpacity={0.85}
                className="rounded-3xl h-14 items-center justify-center border"
                style={{ borderColor: colors.outlineVariant }}
              >
                <Text className="text-on-surface font-jakarta-bold text-base">
                  As que não entendi ({redoCount})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={onExit}
          activeOpacity={0.7}
          className="h-12 items-center justify-center mt-1"
        >
          <Text className="text-outline font-inter-medium text-base">Sair</Text>
        </TouchableOpacity>

        {onAchievements != null && (
          <TouchableOpacity
            className="mt-1 flex-row items-center justify-center gap-1.5"
            activeOpacity={0.7}
            onPress={onAchievements}
          >
            <Ionicons name="trophy-outline" size={16} color={colors.tertiary} />
            <Text className="text-outline font-inter-medium text-sm">
              Ver conquistas
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function LegendRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-6">
      <Text className="text-on-surface-variant font-inter-medium text-base">
        {label}
      </Text>
      <Text
        className="font-jakarta-bold text-base"
        style={{ color, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}
