import * as Notifications from 'expo-notifications';
import { getStore } from './nativeStore';
export interface Reminder { id: string; hour: number; minute: number }
export async function setReminder(userId: string, hour: number, minute: number) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error('Choose a valid reminder time.');
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Reminders are off. You can allow notifications in iPhone Settings.');
  const id = await Notifications.scheduleNotificationAsync({
    identifier: `schwanki-daily-${userId}`,
    content: { title: 'Schwanki', body: 'A few words? The goose is waiting.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  const store = await getStore();
  const previous = await store.get<Reminder>(userId, 'reminder');
  try { await store.set(userId, 'reminder', { id, hour, minute }); }
  catch (error) { await Notifications.cancelScheduledNotificationAsync(id); throw error; }
  if (previous && previous.id !== id) await Notifications.cancelScheduledNotificationAsync(previous.id);
}
export async function cancelReminder(userId: string) {
  const store = await getStore(); const previous = await store.get<Reminder>(userId, 'reminder');
  if (previous) await Notifications.cancelScheduledNotificationAsync(previous.id);
  await store.set(userId, 'reminder', null);
}
