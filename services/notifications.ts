import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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
}

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
 * Reconcilia os agendamentos com as configurações atuais: cancela tudo e
 * reagenda os lembretes ativos. Idempotente — pode ser chamado a cada mudança.
 */
export async function syncReminders(cfg: ReminderConfig): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (cfg.studyReminder) {
    const { hour, minute } = parseTime(cfg.reminderTime);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Hora de estudar 📚',
        body: 'Revise seus decks no Recall e mantenha o ritmo.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
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
