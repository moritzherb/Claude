import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, Text, View } from 'react-native';
import { Body, Btn, Card, Field, H2, LineChart, Muted, Row, Seg, TimeField, ToggleRow } from '../components/ui';
import { notificationsAllowed } from '../reminders';
import {
  calcPlan,
  dateKey,
  DEFAULT_STATE,
  fmt,
  Goal,
  isValidBackup,
  parseKey,
  Profile,
  Settings,
  Sex,
  useStore,
} from '../store';
import { useTheme } from '../theme';

const ACTIVITY = [
  { value: 1.2, label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 1.375, label: 'Light', desc: '1–3 workouts per week' },
  { value: 1.55, label: 'Moderate', desc: '3–5 workouts per week' },
  { value: 1.725, label: 'Very active', desc: '6–7 workouts per week' },
  { value: 1.9, label: 'Athlete', desc: 'Twice a day or physical job' },
];

const INTERVALS = [30, 45, 60, 90, 120].map((v) => ({ value: v, label: `${v}m` }));

export default function GoalsScreen() {
  const { state, update, replace } = useStore();
  const t = useTheme();
  const p = state.profile;

  /* ---------- profile ---------- */
  const [sex, setSex] = useState<Sex>(p?.sex ?? 'male');
  const [age, setAge] = useState(p ? String(p.age) : '');
  const [height, setHeight] = useState(p ? String(p.heightCm) : '');
  const [weight, setWeight] = useState(p ? String(p.weightKg) : '');
  const [activity, setActivity] = useState(p?.activity ?? 1.375);
  const [goal, setGoal] = useState<Goal>(p?.goal ?? 'lose');
  const [rate, setRate] = useState(p?.rate || 0.5);
  const [targetWeight, setTargetWeight] = useState(p?.targetWeight ? String(p.targetWeight) : '');
  const num = (v: string) => Number(v.replace(',', '.'));

  const profileValid = num(age) >= 10 && num(height) >= 100 && num(weight) >= 30;

  const saveProfile = () => {
    if (!profileValid) {
      Alert.alert('Missing info', 'Please enter your age, height (cm) and weight (kg).');
      return;
    }
    const next: Profile = {
      sex,
      age: num(age),
      heightCm: num(height),
      weightKg: num(weight),
      activity,
      goal,
      rate: goal === 'maintain' ? 0 : rate,
      targetWeight: targetWeight ? num(targetWeight) : null,
    };
    update((s) => {
      if (s.profile?.weightKg !== next.weightKg) logWeightDraft(s, next.weightKg);
      s.profile = next;
    });
  };

  const plan = calcPlan(p);

  /* ---------- weight ---------- */
  const [weighIn, setWeighIn] = useState('');
  const logWeight = () => {
    const kg = num(weighIn);
    if (!(kg >= 30 && kg <= 300)) return;
    update((s) => {
      logWeightDraft(s, kg);
      if (s.profile) s.profile.weightKg = kg; // keeps the calorie target in sync
    });
    setWeight(String(kg));
    setWeighIn('');
  };
  const w = state.weights;

  /* ---------- settings ---------- */
  const [set, setSet] = useState<Settings>(state.settings);
  const [nums, setNums] = useState({
    waterGoalMl: String(state.settings.waterGoalMl),
    glassMl: String(state.settings.glassMl),
    stepGoal: String(state.settings.stepGoal),
    kcalOverride: state.settings.kcalOverride ? String(state.settings.kcalOverride) : '',
  });
  useEffect(() => setSet(state.settings), [state.settings]);

  const saveSettings = async () => {
    const next: Settings = {
      ...set,
      waterGoalMl: num(nums.waterGoalMl) || 2500,
      glassMl: num(nums.glassMl) || 250,
      stepGoal: num(nums.stepGoal) || 10000,
      kcalOverride: num(nums.kcalOverride) || null,
    };
    update((s) => void (s.settings = next));
    if (next.waterReminders || next.stepReminders || next.suppReminders) {
      const ok = await notificationsAllowed(true);
      setNotifOk(ok);
      if (!ok) Alert.alert('Notifications are off', 'Turn on notifications in iOS Settings to get reminders.');
    }
  };

  const [notifOk, setNotifOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    notificationsAllowed().then(setNotifOk);
    if (Platform.OS !== 'web') Notifications.getAllScheduledNotificationsAsync().then((n) => setPending(n.length)).catch(() => {});
  }, [state]);

  /* ---------- data ---------- */
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const exportData = () => Share.share({ title: `FitTrack backup ${dateKey()}`, message: JSON.stringify(state) });
  const importData = () => {
    try {
      const data = JSON.parse(importText);
      if (!isValidBackup(data)) throw new Error();
      Alert.alert('Restore backup?', 'This replaces all data in the app.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            replace(data);
            setImportText('');
            setShowImport(false);
          },
        },
      ]);
    } catch {
      Alert.alert('Invalid backup', 'Paste the full text you exported from FitTrack.');
    }
  };
  const reset = () =>
    Alert.alert('Delete all data?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => replace(JSON.parse(JSON.stringify(DEFAULT_STATE))) },
    ]);

  const bmiCat = (b: number) => (b < 18.5 ? 'underweight' : b < 25 ? 'healthy' : b < 30 ? 'overweight' : 'obese');

  return (
    <View>
      <Card>
        <H2>🧮 Calorie calculator</H2>
        <Seg label="Sex" value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        <Row style={{ marginBottom: 10 }}>
          <Field label="Age" keyboardType="number-pad" value={age} onChangeText={setAge} />
          <Field label="Height (cm)" keyboardType="decimal-pad" value={height} onChangeText={setHeight} />
          <Field label="Weight (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
        </Row>
        <Muted style={{ marginBottom: 4 }}>Activity level</Muted>
        <View style={{ borderWidth: 1, borderColor: t.border, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
          {ACTIVITY.map((a, i) => {
            const active = a.value === activity;
            return (
              <Pressable
                key={a.value}
                onPress={() => setActivity(a.value)}
                style={{
                  padding: 10,
                  backgroundColor: active ? t.accent : t.input,
                  borderTopWidth: i ? 0.5 : 0,
                  borderTopColor: t.border,
                }}
              >
                <Text style={{ color: active ? t.accentInk : t.text, fontWeight: '600' }}>{a.label}</Text>
                <Text style={{ color: active ? t.accentInk : t.muted, fontSize: 12 }}>{a.desc}</Text>
              </Pressable>
            );
          })}
        </View>
        <Seg
          label="Goal"
          value={goal}
          onChange={setGoal}
          options={[
            { value: 'lose', label: 'Lose' },
            { value: 'maintain', label: 'Maintain' },
            { value: 'gain', label: 'Gain' },
          ]}
        />
        {goal !== 'maintain' && (
          <Seg
            label="Rate (kg per week)"
            value={rate}
            onChange={setRate}
            options={[0.25, 0.5, 0.75, 1].map((v) => ({ value: v, label: String(v) }))}
          />
        )}
        <Field
          label="Target weight (kg, optional)"
          keyboardType="decimal-pad"
          value={targetWeight}
          onChangeText={setTargetWeight}
          style={{ marginBottom: 12 }}
        />
        <Btn title="Calculate & save" onPress={saveProfile} />

        {plan && p && (
          <View style={{ marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: t.input }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
              {[
                ['BMR', fmt(plan.bmr)],
                ['Maintenance', fmt(plan.tdee)],
                ['Daily target', fmt(plan.target)],
                ['Protein', `${fmt(plan.protein)} g`],
                ['Carbs', `${fmt(plan.carbs)} g`],
                ['Fat', `${fmt(plan.fat)} g`],
              ].map(([l, v], i) => (
                <View key={l} style={{ width: '33.3%' }}>
                  <Muted>{l}</Muted>
                  <Text style={{ color: i === 2 ? t.accent : t.text, fontSize: 18, fontWeight: '700' }}>{v}</Text>
                </View>
              ))}
            </View>
            <Body style={{ marginTop: 10, fontSize: 14 }}>
              BMI {plan.bmi.toFixed(1)} ({bmiCat(plan.bmi)}).
              {plan.weeks ? ` At this rate you'd reach ${p.targetWeight} kg in about ${Math.ceil(plan.weeks)} weeks.` : ''}
            </Body>
            {plan.clamped && <Text style={{ color: t.cal, marginTop: 6 }}>Target raised to a safe minimum — consider a slower rate.</Text>}
            {state.settings.kcalOverride ? (
              <Muted style={{ marginTop: 6 }}>Your manual override of {fmt(state.settings.kcalOverride)} kcal is active.</Muted>
            ) : null}
            <Muted style={{ marginTop: 6 }}>Mifflin-St Jeor estimate. Adjust after 2–3 weeks based on real progress.</Muted>
          </View>
        )}
      </Card>

      <Card>
        <H2>⚖️ Weight progress</H2>
        <Row>
          <Field placeholder="Today's weight (kg)" keyboardType="decimal-pad" value={weighIn} onChangeText={setWeighIn} />
          <Btn title="Log" onPress={logWeight} />
        </Row>
        {w.length ? (
          <>
            <Body style={{ marginVertical: 10, fontSize: 14 }}>
              Current {w[w.length - 1].kg} kg · {w[w.length - 1].kg - w[0].kg > 0 ? '+' : ''}
              {(w[w.length - 1].kg - w[0].kg).toFixed(1)} kg since {parseKey(w[0].date).toLocaleDateString('en-US')}
              {p?.targetWeight ? ` · ${Math.abs(w[w.length - 1].kg - p.targetWeight).toFixed(1)} kg to target` : ''}
            </Body>
            <LineChart points={w.slice(-30)} target={p?.targetWeight} />
          </>
        ) : (
          <Muted style={{ marginTop: 10 }}>No weigh-ins yet.</Muted>
        )}
      </Card>

      <Card>
        <H2>🎯 Daily goals & reminders</H2>
        <Row style={{ marginBottom: 10 }}>
          <Field label="Water goal (ml)" keyboardType="number-pad" value={nums.waterGoalMl} onChangeText={(v) => setNums({ ...nums, waterGoalMl: v })} />
          <Field label="Glass size (ml)" keyboardType="number-pad" value={nums.glassMl} onChangeText={(v) => setNums({ ...nums, glassMl: v })} />
        </Row>
        <Row style={{ marginBottom: 6 }}>
          <Field label="Step goal" keyboardType="number-pad" value={nums.stepGoal} onChangeText={(v) => setNums({ ...nums, stepGoal: v })} />
          <Field
            label="Calorie override"
            placeholder="auto"
            keyboardType="number-pad"
            value={nums.kcalOverride}
            onChangeText={(v) => setNums({ ...nums, kcalOverride: v })}
          />
        </Row>

        <ToggleRow label="💧 Water reminders" value={set.waterReminders} onChange={(v) => setSet({ ...set, waterReminders: v })} />
        {set.waterReminders && (
          <Seg label="Every" value={set.waterReminderMin} onChange={(v) => setSet({ ...set, waterReminderMin: v })} options={INTERVALS} />
        )}
        <ToggleRow label="👟 Move reminders" value={set.stepReminders} onChange={(v) => setSet({ ...set, stepReminders: v })} />
        {set.stepReminders && (
          <Seg label="Every" value={set.stepReminderMin} onChange={(v) => setSet({ ...set, stepReminderMin: v })} options={INTERVALS} />
        )}
        <ToggleRow label="💊 Supplement reminders" value={set.suppReminders} onChange={(v) => setSet({ ...set, suppReminders: v })} />
        <TimeField label="Reminders from" value={set.activeStart} onChange={(v) => setSet({ ...set, activeStart: v })} />
        <TimeField label="Reminders until" value={set.activeEnd} onChange={(v) => setSet({ ...set, activeEnd: v })} />
        <Btn title="Save" onPress={saveSettings} style={{ marginTop: 10 }} />
        <Muted style={{ marginTop: 10 }}>
          {notifOk === false
            ? 'Notifications are off — tap Save to allow them, or enable them in iOS Settings.'
            : `🔔 ${pending} reminder(s) scheduled. Open the app at least every couple of days to keep them topped up.`}
        </Muted>
        {notifOk === false && Platform.OS !== 'web' && (
          <Btn title="Open iOS Settings" kind="ghost" onPress={() => Linking.openSettings()} style={{ marginTop: 8 }} />
        )}
      </Card>

      <Card>
        <H2>💾 Data</H2>
        <Muted style={{ marginBottom: 10 }}>Everything is stored only on this iPhone.</Muted>
        <Row>
          <Btn title="Export backup" kind="ghost" onPress={exportData} style={{ flex: 1 }} />
          <Btn title="Import" kind="ghost" onPress={() => setShowImport(!showImport)} style={{ flex: 1 }} />
        </Row>
        {showImport && (
          <View style={{ marginTop: 10, gap: 8 }}>
            <Field placeholder="Paste your backup text here" value={importText} onChangeText={setImportText} multiline />
            <Btn title="Restore backup" onPress={importData} disabled={!importText} />
          </View>
        )}
        <Btn title="Reset all data" kind="danger" onPress={reset} style={{ marginTop: 10 }} />
      </Card>
    </View>
  );
}

function logWeightDraft(s: { weights: { date: string; kg: number }[] }, kg: number) {
  const k = dateKey();
  const existing = s.weights.find((x) => x.date === k);
  if (existing) existing.kg = kg;
  else s.weights.push({ date: k, kg });
  s.weights.sort((a, b) => a.date.localeCompare(b.date));
}
