import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, dateKey, fmt, getDay, minutesOf, parseKey, State, stepsOf } from './store';

// iOS keeps at most 64 pending local notifications per app.
const MAX_PENDING = 60;
const DAYS_AHEAD = 3;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export interface PlannedReminder {
  date: Date;
  title: string;
  body: string;
}

const at = (k: string, minutes: number) => {
  const d = parseKey(k);
  d.setMinutes(minutes);
  return d;
};

/**
 * Plans one-off reminders for today and the next few days. Today's reminders skip
 * anything already done (water goal met, supplement taken, ...). The plan is rebuilt
 * whenever the data changes, so it stays accurate as long as the app is opened
 * every couple of days.
 */
export function planReminders(s: State, now = new Date()): PlannedReminder[] {
  const st = s.settings;
  const start = minutesOf(st.activeStart);
  const end = minutesOf(st.activeEnd);
  const today = dateKey(now);
  const out: PlannedReminder[] = [];

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const k = addDays(today, i);
    const isToday = i === 0;
    const d = getDay(s, k);

    if (st.waterReminders && !(isToday && d.water >= st.waterGoalMl)) {
      // Count from the last drink so a glass resets the timer.
      const sinceDrink = isToday && s.meta.lastWaterAt ? new Date(s.meta.lastWaterAt) : null;
      for (let m = start + st.waterReminderMin; m <= end; m += st.waterReminderMin) {
        const date = at(k, m);
        if (sinceDrink && date.getTime() - sinceDrink.getTime() < st.waterReminderMin * 60000) continue;
        const left = st.waterGoalMl - (isToday ? d.water : 0);
        out.push({ date, title: '💧 Time to drink water', body: `Have a glass — ${fmt(left)} ml left for today's goal.` });
      }
    }

    if (st.stepReminders && !(isToday && stepsOf(d) >= st.stepGoal)) {
      // Offset from the water reminders so they don't arrive together.
      for (let m = start + st.stepReminderMin + 15; m <= end; m += st.stepReminderMin) {
        out.push({ date: at(k, m), title: '👟 Time to move', body: `Get up and take a short walk. Goal: ${fmt(st.stepGoal)} steps.` });
      }
    }

    if (st.suppReminders) {
      for (const sp of s.supplements) {
        if (!sp.time || (isToday && d.supps[sp.id])) continue;
        out.push({
          date: at(k, minutesOf(sp.time)),
          title: '💊 Supplement time',
          body: `Take ${sp.name}${sp.dose ? ` (${sp.dose})` : ''}.`,
        });
      }
    }
  }

  return out
    .filter((r) => r.date.getTime() > now.getTime() + 30000)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, MAX_PENDING);
}

export async function notificationsAllowed(ask = false): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleReminders(s: State) {
  if (!(await notificationsAllowed())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const plan = planReminders(s);
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
    });
  }
  return plan.length;
}

/** Only the inputs that change the reminder plan, so step-by-step updates don't reschedule. */
export function reminderSignature(s: State) {
  const today = getDay(s, dateKey());
  return JSON.stringify([
    dateKey(),
    s.settings,
    s.supplements,
    today.supps,
    today.water >= s.settings.waterGoalMl,
    stepsOf(today) >= s.settings.stepGoal,
    s.meta.lastWaterAt,
  ]);
}
