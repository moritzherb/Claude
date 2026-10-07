import { Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { addDays, dateKey, draftDay, parseKey, useStore } from './store';

export type StepStatus = 'checking' | 'ok' | 'denied' | 'unavailable';

const HISTORY_DAYS = 7; // iOS keeps about a week of pedometer history

/**
 * Keeps each day's `sensorSteps` in sync with the iPhone's motion coprocessor.
 * iOS counts steps all day in the background, so we just read the totals whenever
 * the app is opened and stream live updates while it's in the foreground.
 */
export function useStepSync() {
  const { update, loaded } = useStore();
  const [status, setStatus] = useState<StepStatus>('checking');
  const sub = useRef<{ remove: () => void } | null>(null);

  const sync = useCallback(async () => {
    sub.current?.remove();
    sub.current = null;

    try {
      if (!(await Pedometer.isAvailableAsync())) {
        setStatus('unavailable');
        return;
      }
      const perm = await Pedometer.requestPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return;
      }
    } catch {
      setStatus('unavailable');
      return;
    }
    setStatus('ok');

    const now = new Date();
    const today = dateKey(now);
    const counts: Record<string, number> = {};
    // Android only supports live counting, not historical queries.
    if (Platform.OS === 'ios') {
      for (let i = 0; i < HISTORY_DAYS; i++) {
        const k = addDays(today, -i);
        const start = parseKey(k);
        const end = i === 0 ? now : parseKey(addDays(k, 1));
        try {
          counts[k] = (await Pedometer.getStepCountAsync(start, end)).steps;
        } catch {}
      }
      update((s) => {
        for (const [k, steps] of Object.entries(counts)) draftDay(s, k).sensorSteps = steps;
      });
    }

    const base = counts[today] ?? 0;
    sub.current = Pedometer.watchStepCount(({ steps }) => {
      if (dateKey() !== today) {
        sync(); // crossed midnight while open
        return;
      }
      update((s) => {
        const d = draftDay(s, today);
        d.sensorSteps = Math.max(d.sensorSteps, base + steps);
      });
    });
  }, [update]);

  useEffect(() => {
    if (!loaded) return;
    sync();
    const appSub = AppState.addEventListener('change', (st) => {
      if (st === 'active') sync();
      else {
        sub.current?.remove();
        sub.current = null;
      }
    });
    return () => {
      appSub.remove();
      sub.current?.remove();
    };
  }, [loaded, sync]);

  return { status, resync: sync };
}
