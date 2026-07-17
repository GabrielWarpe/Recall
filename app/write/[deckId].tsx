import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Deck, Flashcard } from '@/types';
import { db } from '@/services/database';
import { useStudySession } from '@/hooks/useStudySession';
import { useTimedSession } from '@/hooks/useTimedSession';
import { useFinishPrompt } from '@/hooks/useFinishPrompt';
import { useSettings } from '@/contexts/SettingsContext';
import { checkAnswer } from '@/utils/answer';
import { Button } from '@/components/ui/Button';
import { CardImages } from '@/components/CardImages';
import { SessionTimer } from '@/components/SessionTimer';
import { StudySetup } from '@/components/StudySetup';
import { SessionResult } from '@/components/SessionResult';
import { TimeUpNotice } from '@/components/TimeUpNotice';
import { cardShadow } from '@/components/ui/Card';
import { useThemeColors } from '@/hooks/useThemeColors';

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function WriteScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { settings } = useSettings();
  const [deck, setDeck] = useState<Deck | null>(null);

  const session = useStudySession(deck, 'write');
  // Cronômetro + tela de início: mesma lógica de todos os modos.
  const timed = useTimedSession(session);
  // Modal "questões sem resposta" ao finalizar.
  useFinishPrompt(session);

  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Modo prática: deck inteiro, sempre embaralhado. Os cards ficam PENDENTES —
  // quem inicia é a tela de início.
  useEffect(() => {
    if (!deck || timed.started || timed.pending || deck.cards.length === 0) return;
    timed.prepare(shuffle(deck.cards));
  }, [deck, timed.started, timed.pending, timed.prepare]);

  const currentCard: Flashcard | null = session.currentCard;

  // Rascunho zera ao trocar de questão (a resposta salva vem da sessão).
  useEffect(() => {
    setDraft('');
  }, [currentCard?.id]);

  // Resposta salva desta questão — a navegação livre restaura tudo daqui.
  const saved = session.currentAnswer;
  const isCorrect = saved?.correct === true;

  if (!deck) return null;

  // ── Deck vazio ───────────────────────────────────────────────────────────
  if (deck.cards.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.primary + '22' }}
        >
          <Ionicons name="create-outline" size={34} color={colors.primary} />
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Deck vazio
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Adicione cards a este deck para praticar escrevendo.
        </Text>
        <Button
          variant="primary"
          size="lg"
          className="mt-8 w-full"
          onPress={() => router.back()}
        >
          Voltar
        </Button>
      </SafeAreaView>
    );
  }

  const handleVerify = () => {
    if (!currentCard || saved != null) return;
    const input = draft.trim();
    if (input.length === 0) return;
    Keyboard.dismiss();
    const verdict = checkAnswer(input, currentCard.back);
    const correct = verdict === 'exact' || verdict === 'typo';
    session.answer(correct, { typed: input, typedVerdict: verdict });
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(
        correct
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
    }
  };

  const handleDontKnow = () => {
    if (!currentCard || saved != null) return;
    Keyboard.dismiss();
    session.answer(false, { typed: draft.trim(), typedVerdict: 'idk' });
    if (settings.feedbackSounds) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // "Na verdade acertei" — para sinônimos/formulações equivalentes.
  const handleOverride = () => {
    if (!saved || saved.typedVerdict !== 'wrong' || saved.typedOverridden) return;
    session.answer(true, { ...saved, typedOverridden: true });
  };

  // "Trocar resposta": limpa a salva e devolve o texto ao campo para editar.
  const handleChangeAnswer = () => {
    if (!saved) return;
    setDraft(saved.typed ?? '');
    session.clearAnswer();
  };

  // Finalizar: tempo esgotado → sem modal (sem resposta viram Puladas);
  // senão o fluxo normal (modal quando há questões sem resposta).
  const handleFinish = () => {
    if (timed.expired) session.leaveUnanswered();
    else session.finish();
  };

  // 'all' = praticar o deck inteiro de novo; 'wrong' = só as que não entendi
  // nesta sessão. Os ids são lidos ANTES do reset (que os limpa) e a
  // preparação síncrona evita a corrida com o auto-prepare.
  const restart = (scope: 'all' | 'wrong') => {
    const wrong = session.wrongIds;
    const cards =
      scope === 'wrong' ? deck.cards.filter(c => wrong.has(c.id)) : deck.cards;
    setDraft('');
    timed.resetTimed();
    timed.prepare(shuffle(cards));
  };

  // ── Tela de início (config do cronômetro desta sessão) ────────────────────
  if (timed.showSetup && session.phase !== 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StudySetup
          modeLabel="Escrever"
          modeIcon="create"
          deckTitle={deck.title}
          cardCount={timed.pending?.length ?? 0}
          config={timed.config}
          onChange={timed.setConfig}
          onStart={timed.begin}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // ── Resultado final ──────────────────────────────────────────────────────
  if (session.phase === 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <SessionResult
          deckTitle={deck.title}
          correct={session.correctCount}
          wrong={session.againCount}
          skipped={session.skippedCount}
          seconds={session.elapsedSeconds}
          showTime={timed.config.enabled}
          redoCount={session.wrongIds.size}
          priorPct={session.priorAccuracy}
          onRedo={restart}
          onExit={() => router.back()}
          onAchievements={() => router.replace('/achievements')}
        />
      </SafeAreaView>
    );
  }

  // ── Pergunta ativa ───────────────────────────────────────────────────────
  // Progresso = questões RESPONDIDAS (a posição anda livre com Anterior/Próxima).
  const progress = session.total > 0 ? session.done / session.total : 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-2 pb-2">
          <TouchableOpacity onPress={() => router.back()} className="p-2">
            <Ionicons name="close" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View className="flex-1 mx-2">
            <Text
              className="text-on-surface font-jakarta-semibold text-base text-center"
              numberOfLines={1}
            >
              {deck.title}
            </Text>
            {session.inRedoRound && (
              <Text className="text-tertiary font-inter-medium text-xs text-center">
                Refazendo as sem resposta
              </Text>
            )}
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-outline font-inter-regular text-xs">
              {session.position}/{session.sequenceLength}
            </Text>
            {/* Cronômetro desligado ou oculto → sem mostrador. Oculto, o tempo
                continua correndo e sendo gravado (a medição vive na sessão). */}
            {timed.showClock && (
              <SessionTimer
                getDisplay={timed.getDisplay}
                running={session.phase === 'studying'}
                phase={timed.phase}
                countdown={timed.isCountdown}
              />
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View className="mx-5 mb-2">
          <View className="h-1 bg-surface-container-high rounded-pill overflow-hidden">
            <View
              className="h-full rounded-pill bg-primary"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>

        {currentCard != null && (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 24, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Tempo esgotado: este card ainda vale; a sessão encerra depois
                de respondê-lo. */}
            {timed.expired && <TimeUpNotice />}

            {/* Pergunta */}
            <View className="bg-surface-container rounded-card p-6" style={cardShadow}>
              <Text className="text-outline font-inter-semibold text-xs tracking-widest mb-2">
                ESCREVA A RESPOSTA
              </Text>
              <Text className="text-on-surface font-jakarta-bold text-xl leading-7">
                {currentCard.front}
              </Text>
              {currentCard.images.length > 0 && (
                <View className="mt-3 items-start">
                  <CardImages images={currentCard.images} size={72} />
                </View>
              )}
            </View>

            {saved == null ? (
              <>
                {/* Campo de resposta */}
                <TextInput
                  key={currentCard.id}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={handleVerify}
                  placeholder="Digite sua resposta..."
                  placeholderTextColor={colors.outline}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="done"
                  className="bg-surface-container rounded-card px-4 py-4 text-on-surface font-inter-regular text-base border border-outline-variant"
                  selectionColor={colors.primary}
                />
                <Button
                  variant="primary"
                  size="lg"
                  disabled={draft.trim().length === 0}
                  onPress={handleVerify}
                >
                  Verificar
                </Button>
                <TouchableOpacity
                  onPress={handleDontKnow}
                  activeOpacity={0.7}
                  className="py-1 items-center"
                >
                  <Text className="text-outline font-inter-medium text-sm">
                    Não sei
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Feedback (restaurado da sessão ao revisitar a questão) */}
                <View
                  className={`rounded-card p-4 border ${
                    isCorrect
                      ? 'bg-success/15 border-success'
                      : 'bg-error/15 border-error'
                  }`}
                >
                  <Text
                    className={`font-inter-semibold text-sm ${
                      isCorrect ? 'text-success' : 'text-error'
                    }`}
                  >
                    {saved.typedOverridden
                      ? '✓ Marcado como certo'
                      : saved.typedVerdict === 'exact'
                        ? '✓ Correto!'
                        : saved.typedVerdict === 'typo'
                          ? '✓ Quase perfeito — só um errinho de digitação'
                          : saved.typedVerdict === 'idk'
                            ? 'Sem problema — a resposta era:'
                            : '✗ Não foi dessa vez. A resposta era:'}
                  </Text>
                  <Text className="text-on-surface font-jakarta-bold text-base mt-2 leading-6">
                    {currentCard.back}
                  </Text>
                  {saved.typedVerdict === 'wrong' &&
                    (saved.typed?.length ?? 0) > 0 && (
                      <Text className="text-outline font-inter-regular text-xs mt-2">
                        Você escreveu: “{saved.typed}”
                      </Text>
                    )}
                </View>

                <View className="flex-row items-center justify-center gap-6">
                  {saved.typedVerdict === 'wrong' && !saved.typedOverridden && (
                    <TouchableOpacity
                      onPress={handleOverride}
                      activeOpacity={0.7}
                      className="py-1"
                    >
                      <Text className="text-primary font-inter-medium text-sm">
                        Minha resposta estava certa
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleChangeAnswer}
                    activeOpacity={0.7}
                    className="py-1"
                  >
                    <Text className="text-outline font-inter-medium text-sm">
                      Trocar resposta
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Navegação livre: voltar/avançar sem responder; sem resposta =
                tratado no Finalizar (modal de questões sem resposta). */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={session.prev}
                disabled={!session.canPrev}
                activeOpacity={0.7}
                className="flex-1 rounded-3xl flex-row items-center justify-center gap-1.5 border py-3.5"
                style={{
                  borderColor: colors.outlineVariant,
                  opacity: session.canPrev ? 1 : 0.4,
                }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.onSurface} />
                <Text className="text-on-surface font-inter-semibold text-sm">
                  Anterior
                </Text>
              </TouchableOpacity>

              {session.isLastPosition || timed.expired ? (
                <View className="flex-1">
                  <Button variant="primary" size="md" onPress={handleFinish}>
                    Finalizar
                  </Button>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={session.next}
                  activeOpacity={0.7}
                  className="flex-1 rounded-3xl flex-row items-center justify-center gap-1.5 border py-3.5"
                  style={{ borderColor: colors.outlineVariant }}
                >
                  <Text className="text-on-surface font-inter-semibold text-sm">
                    Próxima
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.onSurface}
                  />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
