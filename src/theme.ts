import { useColorScheme } from 'react-native';

const shared = {
  cal: '#f97316',
  steps: '#8b5cf6',
  water: '#0ea5e9',
  supps: '#10b981',
  protein: '#ef4444',
  carbs: '#eab308',
  fat: '#3b82f6',
};

const light = {
  ...shared,
  bg: '#f4f6f8',
  card: '#ffffff',
  input: '#f4f6f8',
  text: '#15202b',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#0f766e',
  accentInk: '#ffffff',
  ringBg: '#e8edf2',
  danger: '#dc2626',
};

const dark: typeof light = {
  ...shared,
  bg: '#0b1117',
  card: '#151d26',
  input: '#0b1117',
  text: '#e6edf3',
  muted: '#8b98a8',
  border: '#253141',
  accent: '#2dd4bf',
  accentInk: '#062a27',
  ringBg: '#223040',
  danger: '#f87171',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
