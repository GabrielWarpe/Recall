import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Deck } from '@/types';
import { db } from '@/services/database';
import { getSessionCards } from '@/services/ai';
import { useStudySession } from '@/hooks/useStudySession';
import { useTimedSession } from '@/hooks/useTimedSession';
import { deckSupportsQuiz, cardSupportsQuiz } from '@/utils/practice';
import { QuizQuestion } from '@/components/QuizQuestion';
import { SessionTimer } from '@/components/SessionTimer';
import { StudySetup } from '@/components/StudySetup';
import { SessionResult } from '@/components/SessionResult';
import { TIME_UP_MESSAGE } from '@/components/TimeUpNotice';
import { Button } from '@/components/ui/Button';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function QuizScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [noDue, setNoDue] = useState(false);

  const session = useStudySession(deck, 'quiz');
  // Cronômetro + tela de início: mesma lógica de todos os modos.
  const timed = useTimedSession(session);


  useEffect(() => {
    if (!deckId) return;
    void db.decks.getOne(deckId).then(d => {
      if (d) setDeck(d);
    });
  }, [deckId]);

  // Mesma seleção do estudo (devidos + novos), restrita aos cards que TÊM
  // alternativas autoradas — só eles são perguntas de quiz. O quiz também
  // conta para o agendamento SM-2. Sem nada devido → "Tudo em dia".
  // Os cards ficam PENDENTES: quem inicia é a tela de início.
  useEffect(() => {
    if (!deck || timed.started || noDue || timed.pending || !deckSupportsQuiz(deck))
      return;
    const cards = getSessionCards(deck).filter(cardSupportsQuiz);
    if (cards.length > 0) timed.prepare(cards);
    else setNoDue(true);
  }, [deck, noDue, timed.started, timed.pending, timed.prepare]);

  const practiceAll = () => {
    if (!deck) return;
    setNoDue(false);
    timed.prepare(deck.cards.filter(cardSupportsQuiz));
  };

  // Refaz a prática: 'all' = todas as questões de novo; 'wrong' = só as que
  // foram erradas ao menos uma vez nesta sessão. Prepara direto do estado (sem
  // recarregar o deck): os ids errados são lidos ANTES do reset, que os limpa,
  // e preparar na mesma renderização evita a corrida com o auto-prepare.
  const restart = (scope: 'all' | 'wrong') => {
    if (!deck) return;
    const wrong = session.wrongIds;
    const base = deck.cards.filter(cardSupportsQuiz);
    const cards = scope === 'wrong' ? base.filter(c => wrong.has(c.id)) : base;
    setNoDue(false);
    timed.resetTimed();
    timed.prepare(cards);
  };

  if (!deck) return null;

  // ── Deck sem material para alternativas ──────────────────────────────────
  if (!deckSupportsQuiz(deck)) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.primary + '22' }}
        >
          <Ionicons name="help-circle-outline" size={36} color={colors.primary} />
        </View>
        <Text className="text-on-surface font-jakarta-bold text-2xl text-center">
          Quiz indisponível
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Nenhum card deste deck tem alternativas de quiz. Edite um card e
          adicione pelo menos 2 alternativas erradas para criar a pergunta.
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

  // ── Tudo em dia (nada devido) ─────────────────────────────────────────────
  if (noDue && session.phase !== 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <View
          className="w-20 h-20 rounded-card items-center justify-center mb-5"
          style={{ backgroundColor: colors.success + '22' }}
        >
          <Ionicons name="checkmark-done" size={36} color={colors.success} />
        </View>
        <Text className="text-on-surface font-jakarta-extrabold text-2xl text-center">
          Tudo em dia!
        </Text>
        <Text className="text-outline font-inter-regular text-sm text-center mt-2">
          Você não tem cards para revisar neste deck agora. Volte mais tarde ou
          pratique mesmo assim.
        </Text>
        <View className="w-full mt-8 gap-3">
          <Button variant="primary" size="lg" onPress={practiceAll}>
            Praticar tudo
          </Button>
          <Button variant="outline" size="lg" onPress={() => router.back()}>
            Voltar
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // ── Tela de início (config do cronômetro desta sessão) ────────────────────
  if (timed.showSetup && session.phase !== 'finished') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <StudySetup
          modeLabel="Quiz"
          modeIcon="help-circle"
          deckTitle={deck.title}
          cardCount={timed.pending?.length ?? 0}
          itemNoun={['questão', 'questões']}
          config={timed.config}
          onChange={timed.setConfig}
          onStart={timed.begin}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  // ── Resultado ────────────────────────────────────────────────────────────
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
          onRedo={restart}
          onExit={() => router.back()}
          onAchievements={() => router.replace('/achievements')}
        />
      </SafeAreaView>
    );
  }

  // ── Pergunta ativa ───────────────────────────────────────────────────────
  const currentCard = session.currentCard;
  // Identidade única da pergunta atual (done/againCount avançam a cada card).
  const questionKey = currentCard
    ? `${currentCard.id}:${session.done}:${session.againCount}`
    : '';
  const progress = session.total > 0 ? session.done / session.total : 0;
  const position = Math.min(session.done + 1, session.total);
  const isLast = session.total - session.done === 1;

  // Acertou ou errou (uma passada — o card sai da fila; o SM-2 o reagenda
  // para outro dia se errar).
  const handleAnswer = (correct: boolean) => {
    session.answer(correct);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
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
        </View>
        <View className="items-end gap-0.5">
          <Text className="text-outline font-inter-regular text-xs">
            {position}/{session.total}
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
        // SEM prop `key`: a troca de pergunta é comunicada pelo questionKey e
        // os guards anti-toque-duplo internos sobrevivem entre perguntas.
        <QuizQuestion
          card={currentCard}
          questionKey={questionKey}
          isLast={isLast || timed.expired}
          notice={timed.expired ? TIME_UP_MESSAGE : undefined}
          onAnswer={handleAnswer}
          onSkip={() => session.skip()}
        />
      )}
    </SafeAreaView>
  );
}
