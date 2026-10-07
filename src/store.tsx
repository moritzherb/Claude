import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'maintain' | 'gain';
export type Meal = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface Profile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: Goal;
  rate: number;
  targetWeight: number | null;
}

export interface Settings {
  waterGoalMl: number;
  glassMl: number;
  stepGoal: number;
  kcalOverride: number | null;
  waterReminders: boolean;
  waterReminderMin: number;
  stepReminders: boolean;
  stepReminderMin: number;
  suppReminders: boolean;
  activeStart: string;
  activeEnd: string;
}

export interface Food {
  id: string;
  name: string;
  meal: Meal;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  at: number;
}

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  time: string; // "HH:MM" or ""
}

export interface Day {
  water: number;
  waterLog: number[];
  sensorSteps: number; // from the iPhone motion coprocessor
  manualSteps: number; // added by hand
  foods: Food[];
  supps: Record<string, string>; // supplement id -> time taken
}

export interface FoodTemplate {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface State {
  profile: Profile | null;
  settings: Settings;
  supplements: Supplement[];
  days: Record<string, Day>;
  weights: { date: string; kg: number }[];
  foodLibrary: Record<string, FoodTemplate>;
  meta: { lastWaterAt: number };
}

export const DEFAULT_STATE: State = {
  profile: null,
  settings: {
    waterGoalMl: 2500,
    glassMl: 250,
    stepGoal: 10000,
    kcalOverride: null,
    waterReminders: true,
    waterReminderMin: 60,
    stepReminders: true,
    stepReminderMin: 90,
    suppReminders: true,
    activeStart: '08:00',
    activeEnd: '21:00',
  },
  supplements: [],
  days: {},
  weights: [],
  foodLibrary: {},
  meta: { lastWaterAt: 0 },
};

const STORAGE_KEY = 'fittrack:v1';

/* ---------- helpers ---------- */

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export const minutesOf = (hhmm: string) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return h * 60 + m;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export const emptyDay = (): Day => ({ water: 0, waterLog: [], sensorSteps: 0, manualSteps: 0, foods: [], supps: {} });

export const getDay = (s: State, k: string): Day => s.days[k] ?? emptyDay();

/** Returns the day for mutation inside `update`, creating it if needed. */
export const draftDay = (s: State, k: string): Day => (s.days[k] ??= emptyDay());

export const stepsOf = (d: Day) => d.sensorSteps + d.manualSteps;

export const totals = (d: Day) =>
  d.foods.reduce(
    (t, f) => ({ kcal: t.kcal + f.kcal, protein: t.protein + f.protein, carbs: t.carbs + f.carbs, fat: t.fat + f.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );

/* ---------- calorie calculator ---------- */

export function calcPlan(p: Profile | null) {
  if (!p) return null;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * p.activity;
  const dailyDelta = (p.rate * 7700) / 7; // ~7700 kcal per kg body weight
  let target = tdee;
  if (p.goal === 'lose') target = tdee - dailyDelta;
  if (p.goal === 'gain') target = tdee + dailyDelta;
  const floor = p.sex === 'male' ? 1500 : 1200;
  const clamped = target < floor;
  target = Math.max(target, floor);

  const protein = p.weightKg * (p.goal === 'maintain' ? 1.6 : 2.0);
  const fat = (target * 0.25) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);
  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  const weeks =
    p.targetWeight && p.goal !== 'maintain' && p.rate > 0 ? Math.abs(p.weightKg - p.targetWeight) / p.rate : null;
  return { bmr, tdee, target, clamped, protein, fat, carbs, bmi, weeks };
}

export const calorieTarget = (s: State) => s.settings.kcalOverride || calcPlan(s.profile)?.target || 2000;

export const currentWeight = (s: State) => s.weights[s.weights.length - 1]?.kg ?? s.profile?.weightKg ?? 70;

// Rough walking estimate: ~0.04 kcal per step for a 70 kg person.
export const stepsToKcal = (s: State, steps: number) => steps * 0.04 * (currentWeight(s) / 70);

/* ---------- context ---------- */

interface Store {
  state: State;
  loaded: boolean;
  update: (fn: (draft: State) => void) => void;
  replace: (next: State) => void;
}

const Ctx = createContext<Store | null>(null);

function normalize(raw: Partial<State>): State {
  return {
    ...DEFAULT_STATE,
    ...raw,
    settings: { ...DEFAULT_STATE.settings, ...raw.settings },
    meta: { ...DEFAULT_STATE.meta, ...raw.meta },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => raw && setState(normalize(JSON.parse(raw))))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 300);
  }, [state, loaded]);

  const update = useCallback((fn: (draft: State) => void) => {
    setState((prev) => {
      const draft: State = JSON.parse(JSON.stringify(prev));
      fn(draft);
      return draft;
    });
  }, []);

  const replace = useCallback((next: State) => setState(normalize(next)), []);

  return <Ctx.Provider value={{ state, loaded, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

export function isValidBackup(x: unknown): x is State {
  return !!x && typeof x === 'object' && 'days' in x && 'settings' in x;
}
