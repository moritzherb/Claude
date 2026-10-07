import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { reminderSignature, scheduleReminders } from './src/reminders';
import FoodScreen from './src/screens/FoodScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import StepsScreen from './src/screens/StepsScreen';
import SuppsScreen from './src/screens/SuppsScreen';
import TodayScreen from './src/screens/TodayScreen';
import { useStepSync } from './src/steps';
import { addDays, dateKey, parseKey, StoreProvider, useStore } from './src/store';
import { useTheme } from './src/theme';

export type Tab = 'today' | 'food' | 'supps' | 'steps' | 'goals';

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'today', icon: '🏠', label: 'Today' },
  { key: 'food', icon: '🍽️', label: 'Food' },
  { key: 'supps', icon: '💊', label: 'Supps' },
  { key: 'steps', icon: '👟', label: 'Steps' },
  { key: 'goals', icon: '🎯', label: 'Goals' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, loaded } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [viewKey, setViewKey] = useState(dateKey());
  const [today, setToday] = useState(dateKey());
  const scroll = useRef<ScrollView>(null);
  const { status: stepStatus } = useStepSync();

  // Jump to the new day when the app is reopened after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      const k = dateKey();
      if (k !== today) {
        setViewKey((v) => (v === today ? k : v));
        setToday(k);
      }
    });
    return () => sub.remove();
  }, [today]);

  // Re-plan local notifications whenever something that affects them changes.
  const signature = loaded ? reminderSignature(state) : '';
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    if (!loaded || Platform.OS === 'web') return;
    const timer = setTimeout(() => scheduleReminders(latest.current).catch(() => {}), 1500);
    return () => clearTimeout(timer);
  }, [signature, loaded]);

  const go = (next: Tab) => {
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  const isToday = viewKey === today;
  const d = parseKey(viewKey);
  const diff = Math.round((parseKey(today).getTime() - d.getTime()) / 86400000);
  const title = isToday ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long' });
  const showDateNav = tab !== 'goals';

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="auto" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        {showDateNav ? (
          <>
            <NavBtn label="‹" onPress={() => setViewKey(addDays(viewKey, -1))} />
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.title, { color: t.text }]}>{title}</Text>
              <Text style={{ color: t.muted, fontSize: 13 }}>
                {d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <NavBtn label="›" disabled={isToday} onPress={() => setViewKey(addDays(viewKey, 1))} />
          </>
        ) : (
          <Text style={[styles.title, { color: t.text, flex: 1, textAlign: 'center', paddingVertical: 10 }]}>Goals & settings</Text>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          {tab === 'today' && <TodayScreen viewKey={viewKey} goTo={go} />}
          {tab === 'food' && <FoodScreen viewKey={viewKey} />}
          {tab === 'supps' && <SuppsScreen viewKey={viewKey} />}
          {tab === 'steps' && <StepsScreen viewKey={viewKey} status={stepStatus} />}
          {tab === 'goals' && <GoalsScreen key={JSON.stringify([state.profile, state.settings])} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.tabBar, { backgroundColor: t.card, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((x) => {
          const active = x.key === tab;
          return (
            <Pressable key={x.key} onPress={() => go(x.key)} style={styles.tabItem} accessibilityRole="tab" accessibilityState={{ selected: active }}>
              <Text style={{ fontSize: 22, opacity: active ? 1 : 0.45 }}>{x.icon}</Text>
              <Text style={{ fontSize: 11, color: active ? t.accent : t.muted, fontWeight: active ? '700' : '500' }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NavBtn({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.navBtn, { borderColor: t.border, backgroundColor: t.card, opacity: disabled ? 0.3 : 1 }]}
    >
      <Text style={{ color: t.text, fontSize: 22, lineHeight: 26 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  navBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
});
