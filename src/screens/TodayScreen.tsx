import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BarChart, Body, Btn, Card, Chip, Field, H2, Muted, ProgressBar, Ring, Row } from '../components/ui';
import {
  addDays,
  calcPlan,
  calorieTarget,
  dateKey,
  draftDay,
  fmt,
  getDay,
  parseKey,
  stepsOf,
  stepsToKcal,
  totals,
  useStore,
} from '../store';
import { useTheme } from '../theme';
import type { Tab } from '../../App';

type Metric = 'kcal' | 'steps' | 'water';

export default function TodayScreen({ viewKey, goTo }: { viewKey: string; goTo: (t: Tab) => void }) {
  const { state, update } = useStore();
  const t = useTheme();
  const [metric, setMetric] = useState<Metric>('kcal');
  const [customMl, setCustomMl] = useState('');
  const s = state.settings;
  const d = getDay(state, viewKey);
  const tot = totals(d);
  const target = calorieTarget(state);
  const steps = stepsOf(d);
  const taken = state.supplements.filter((x) => d.supps[x.id]).length;

  const addWater = (ml: number) => {
    if (!(ml > 0)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    update((st) => {
      const day = draftDay(st, viewKey);
      day.water += ml;
      day.waterLog.push(ml);
      if (viewKey === dateKey()) st.meta.lastWaterAt = Date.now();
    });
  };

  const undoWater = () =>
    update((st) => {
      const day = draftDay(st, viewKey);
      const ml = day.waterLog.pop();
      if (ml != null) day.water = Math.max(0, day.water - ml);
    });

  const glasses = Math.ceil(s.waterGoalMl / s.glassMl);
  const left = s.waterGoalMl - d.water;
  const remain = target - tot.kcal;
  const plan = calcPlan(state.profile);

  const keys = Array.from({ length: 7 }, (_, i) => addDays(viewKey, i - 6));
  const chart = {
    kcal: { vals: keys.map((k) => totals(getDay(state, k)).kcal), goal: target, color: t.cal },
    steps: { vals: keys.map((k) => stepsOf(getDay(state, k))), goal: s.stepGoal, color: t.steps },
    water: { vals: keys.map((k) => getDay(state, k).water), goal: s.waterGoalMl, color: t.water },
  }[metric];

  return (
    <View>
      {!state.profile && (
        <Card>
          <H2>👋 Welcome to FitTrack</H2>
          <Body style={{ marginBottom: 12 }}>Set up your profile to get a personalised calorie target.</Body>
          <Btn title="Set up my goals" onPress={() => goTo('goals')} />
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <Ring
          title="Calories"
          color={t.cal}
          ratio={tot.kcal / target}
          over={tot.kcal > target * 1.05}
          value={fmt(tot.kcal)}
          sub={`/ ${fmt(target)} kcal`}
          onPress={() => goTo('food')}
        />
        <Ring title="Steps" color={t.steps} ratio={steps / s.stepGoal} value={fmt(steps)} sub={`/ ${fmt(s.stepGoal)}`} onPress={() => goTo('steps')} />
        <Ring
          title="Water"
          color={t.water}
          ratio={d.water / s.waterGoalMl}
          value={fmt(d.water)}
          sub={`/ ${fmt(s.waterGoalMl)} ml`}
          onPress={() => addWater(s.glassMl)}
        />
        <Ring
          title="Supplements"
          color={t.supps}
          ratio={state.supplements.length ? taken / state.supplements.length : 0}
          value={String(taken)}
          sub={`/ ${state.supplements.length}`}
          onPress={() => goTo('supps')}
        />
      </View>

      <Card>
        <H2
          right={
            d.waterLog.length ? (
              <Pressable onPress={undoWater} hitSlop={8}>
                <Text style={{ color: t.accent }}>Undo</Text>
              </Pressable>
            ) : null
          }
        >
          💧 Water
        </H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {Array.from({ length: glasses }, (_, i) => {
            const fill = Math.min(Math.max((d.water - i * s.glassMl) / s.glassMl, 0), 1);
            return (
              <View key={i} style={{ width: 24, height: 32, borderWidth: 2, borderTopWidth: 0, borderColor: t.water, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' }}>
                <View style={{ height: `${fill * 100}%`, backgroundColor: t.water, opacity: 0.85 }} />
              </View>
            );
          })}
        </View>
        <Row>
          <Btn title={`+ Glass`} onPress={() => addWater(s.glassMl)} style={{ flex: 1 }} />
          <Btn title="+ 500 ml" onPress={() => addWater(500)} style={{ flex: 1 }} />
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Field placeholder="Custom ml" keyboardType="number-pad" value={customMl} onChangeText={setCustomMl} />
          <Btn
            title="Add"
            kind="ghost"
            onPress={() => {
              addWater(Number(customMl));
              setCustomMl('');
            }}
          />
        </Row>
        <Muted style={{ marginTop: 10 }}>
          {left > 0 ? `${fmt(left)} ml to go — about ${Math.ceil(left / s.glassMl)} more glass(es).` : 'Water goal reached! 🎉'}
        </Muted>
      </Card>

      <Card>
        <H2>🔥 Energy balance</H2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          {[
            ['Target', fmt(target)],
            ['Eaten', fmt(tot.kcal)],
            ['Burned (steps, est.)', fmt(stepsToKcal(state, steps))],
            ['Remaining', remain >= 0 ? fmt(remain) : `+${fmt(-remain)} over`],
          ].map(([label, val], i) => (
            <View key={label} style={{ width: '50%' }}>
              <Muted>{label}</Muted>
              <Text style={{ color: i === 3 && remain < 0 ? t.danger : t.text, fontSize: 20, fontWeight: '700' }}>{val}</Text>
            </View>
          ))}
        </View>
        {plan && (
          <View style={{ marginTop: 14, gap: 10 }}>
            {(
              [
                ['Protein', tot.protein, plan.protein, t.protein],
                ['Carbs', tot.carbs, plan.carbs, t.carbs],
                ['Fat', tot.fat, plan.fat, t.fat],
              ] as const
            ).map(([name, v, g0, color]) => {
              const g = g0 * (target / plan.target);
              return (
                <View key={name}>
                  <Muted style={{ marginBottom: 4 }}>
                    <Text style={{ color: t.text }}>{name}</Text> {fmt(v)} / {fmt(g)} g
                  </Muted>
                  <ProgressBar ratio={v / g} color={color} />
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <H2>📈 Last 7 days</H2>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          <Chip label="Calories" active={metric === 'kcal'} onPress={() => setMetric('kcal')} />
          <Chip label="Steps" active={metric === 'steps'} onPress={() => setMetric('steps')} />
          <Chip label="Water" active={metric === 'water'} onPress={() => setMetric('water')} />
        </View>
        <BarChart
          values={chart.vals}
          goal={chart.goal}
          color={chart.color}
          highlight={6}
          labels={keys.map((k) => parseKey(k).toLocaleDateString('en-US', { weekday: 'narrow' }))}
        />
      </Card>
    </View>
  );
}
