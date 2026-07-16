import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Deck } from '@/types';
import { db } from './database';

// Mostra a notificação mesmo com o app aberto.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export interface ReminderConfig {
  studyReminder: boolean;
  reminderTime: string; // "HH:MM"
  streakAlert: boolean;
  /** Dono dos decks — sem ele o lembrete de estudo não é agendado. */
  userId?: string | null;
}

/** Quantos dias à frente agendamos lembretes com contagem exata. */
const REMINDER_HORIZON_DAYS = 7;

/** Garante permissão de notificações (pede se ainda não concedida). */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(n => parseInt(n, 10));
  return {
    hour: Number.isFinite(h) ? h : 20,
    minute: Number.isFinite(m) ? m : 0,
  };
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Lembretes de estudo',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Dispara uma notificação local IMEDIATA (conquistas, marcos de sequência).
 * Só dispara se a permissão já foi concedida — nunca pede no meio do estudo.
 */
export async function fireNotification(
  title: string,
  body: string,
): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // imediata
  });
}

export async function fireStreakNotification(days: number): Promise<void> {
  await fireNotification(
    `🔥 Sequência de ${days} ${days === 1 ? 'dia' : 'dias'}!`,
    'Você manteve sua ofensiva hoje. Continue assim!',
  );
}

/**
 * Quantos cards estarão "para revisar" no instante `at`: devidos de verdade
 * (já vistos, com revisão vencida até lá) + novos, limitados por sessão —
 * o mesmo critério do "Revisar hoje" da Home. Como `nextReview` só muda
 * quando o card é revisado, a contagem futura é determinística.
 */
function dueCountAt(decks: Deck[], at: Date): number {
  return decks.reduce((sum, deck) => {
    const due = deck.cards.filter(
      c => c.repetitions > 0 && new Date(c.nextReview) <= at,
    ).length;
    const news = deck.cards.filter(c => c.repetitions === 0).length;
    return sum + due + news;
  }, 0);
}

function dateAt(daysFromToday: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/**
 * Lembretes de estudo INTELIGENTES: um agendamento pontual por dia (próximos
 * 7), apenas nos dias em que haverá cards a revisar, com a contagem exata no
 * corpo. Recalculados a cada sync (abrir o app, mudar configs, fim de sessão).
 */
async function scheduleStudyReminders(
  cfg: ReminderConfig,
  hour: number,
  minute: number,
): Promise<void> {
  // Sem usuário logado não há o que contar.
  if (!cfg.userId) return;

  let decks: Deck[] | null = null;
  try {
    decks = await db.decks.getAll(cfg.userId);
  } catch {
    decks = null;
  }

  // Offline/erro ao carregar: mantém o lembrete genérico diário de antes,
  // para o app não ficar mudo por causa de uma falha de rede.
  if (decks === null) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hora de estudar 📚',
        body: 'Revise seus decks no Blink e mantenha o ritmo.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    return;
  }

  const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
  if (totalCards === 0) return; // nada para estudar, nada para lembrar

  const now = new Date();

  for (let day = 0; day < REMINDER_HORIZON_DAYS; day++) {
    const fireDate = dateAt(day, hour, minute);
    if (fireDate <= now) continue; // horário de hoje já passou
    const count = dueCountAt(decks, fireDate);
    if (count === 0) continue; // dia em dia com as revisões: não incomoda
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hora de revisar 🧠',
        body: `Você tem ${count} ${count === 1 ? 'card' : 'cards'} para revisar. Bora manter o ritmo!`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
  }

  // Rede de segurança: se o app ficar 8+ dias sem abrir (nenhum sync novo),
  // dispara um lembrete único de retorno.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sentimos sua falta 👋',
      body: 'Seus decks estão esperando por você. Que tal uma revisão rápida hoje?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dateAt(REMINDER_HORIZON_DAYS + 1, hour, minute),
    },
  });
}

/**
 * Reconcilia os agendamentos com as configurações atuais: cancela tudo e
 * reagenda os lembretes ativos. Idempotente — pode ser chamado a cada mudança.
 */
export async function syncReminders(cfg: ReminderConfig): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (cfg.studyReminder) {
    const { hour, minute } = parseTime(cfg.reminderTime);
    await scheduleStudyReminders(cfg, hour, minute);
  }

  if (cfg.streakAlert) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Não perca sua sequência! 🔥',
        body: 'Estude hoje para manter sua ofensiva ativa.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 21,
        minute: 0,
      },
    });
  }
}
