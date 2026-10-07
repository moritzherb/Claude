import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { Btn, Card, Field, H2, Muted, ProgressBar, Row } from '../components/ui';
import type { StepStatus } from '../steps';
import { draftDay, fmt, getDay, stepsOf, stepsToKcal, useStore } from '../store';
import { useTheme } from '../theme';

const STATUS_TEXT: Record<StepStatus, string> = {
  checking: 'Connecting to the motion sensor…',
  ok: '🟢 Counting automatically with your iPhone’s motion sensor — even when the app is closed.',
  denied: 'Motion & Fitness access is off. Turn it on in Settings → FitTrack (or Expo Go) → Motion & Fitness.',
  unavailable: 'Step counting isn’t available on this device. You can still add steps by hand.',
};

export default function StepsScreen({ viewKey, status }: { viewKey: string; status: StepStatus }) {
  const { state, update } = useStore();
  const t = useTheme();
  const [input, setInput] = useState('');
  const d = getDay(state, viewKey);
  const steps = stepsOf(d);
  const goal = state.settings.stepGoal;

  const addManual = () => {
    const n = Math.round(Number(input));
    if (!(n > 0)) return;
    update((s) => void (draftDay(s, viewKey).manualSteps += n));
    setInput('');
  };

  const clearManual = () => update((s) => void (draftDay(s, viewKey).manualSteps = 0));

  return (
    <View>
      <Card style={{ alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', marginVertical: 8 }}>
          <Text style={{ fontSize: 52, fontWeight: '800', color: t.steps }}>{fmt(steps)}</Text>
          <Muted>steps</Muted>
        </View>
        <ProgressBar ratio={steps / goal} color={t.steps} height={12} />
        <Muted style={{ textAlign: 'center', marginTop: 8 }}>
          Goal {fmt(goal)} · ≈ {((steps * 0.75) / 1000).toFixed(2)} km · ≈ {fmt(stepsToKcal(state, steps))} kcal
        </Muted>
        <Muted style={{ textAlign: 'center', marginTop: 12, color: status === 'denied' ? t.danger : t.muted }}>{STATUS_TEXT[status]}</Muted>
        {status === 'denied' && <Btn title="Open Settings" kind="ghost" onPress={() => Linking.openSettings()} style={{ marginTop: 10 }} />}
      </Card>

      <Card>
        <H2>Add steps by hand</H2>
        <Muted style={{ marginBottom: 10 }}>For walks without your phone, e.g. from an Apple Watch or treadmill.</Muted>
        <Row>
          <Field placeholder="Steps" keyboardType="number-pad" value={input} onChangeText={setInput} />
          <Btn title="Add" onPress={addManual} />
        </Row>
        {d.manualSteps > 0 && (
          <Row style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <Muted>
              Sensor {fmt(d.sensorSteps)} + manual {fmt(d.manualSteps)}
            </Muted>
            <Btn title="Clear manual" kind="danger" onPress={clearManual} />
          </Row>
        )}
      </Card>
    </View>
  );
}
