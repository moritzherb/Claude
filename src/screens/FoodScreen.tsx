import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Card, Chip, Field, H2, ListRow, Muted, Row, Seg } from '../components/ui';
import { draftDay, fmt, getDay, Meal, totals, uid, useStore } from '../store';
import { useTheme } from '../theme';

const MEALS: Meal[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function guessMeal(): Meal {
  const h = new Date().getHours();
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 17 ? 'Snack' : h < 21 ? 'Dinner' : 'Snack';
}

const blank = { name: '', kcal: '', protein: '', carbs: '', fat: '', servings: '1' };

export default function FoodScreen({ viewKey }: { viewKey: string }) {
  const { state, update } = useStore();
  const t = useTheme();
  const [form, setForm] = useState(blank);
  const [meal, setMeal] = useState<Meal>(guessMeal);
  const d = getDay(state, viewKey);
  const set = (k: keyof typeof blank) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => Number(v.replace(',', '.')) || 0;

  const query = form.name.trim().toLowerCase();
  const suggestions = Object.keys(state.foodLibrary)
    .filter((n) => (query ? n.toLowerCase().includes(query) && n.toLowerCase() !== query : true))
    .slice(0, 6);

  const pick = (name: string) => {
    const f = state.foodLibrary[name];
    setForm({ name, kcal: String(f.kcal), protein: String(f.protein || ''), carbs: String(f.carbs || ''), fat: String(f.fat || ''), servings: '1' });
  };

  const canAdd = form.name.trim() !== '' && num(form.kcal) > 0;

  const add = () => {
    if (!canAdd) return;
    const name = form.name.trim();
    const servings = num(form.servings) || 1;
    const base = { kcal: num(form.kcal), protein: num(form.protein), carbs: num(form.carbs), fat: num(form.fat) };
    update((s) => {
      s.foodLibrary[name] = base;
      draftDay(s, viewKey).foods.push({
        id: uid(),
        name: servings !== 1 ? `${name} ×${servings}` : name,
        meal,
        kcal: base.kcal * servings,
        protein: base.protein * servings,
        carbs: base.carbs * servings,
        fat: base.fat * servings,
        at: Date.now(),
      });
    });
    setForm(blank);
  };

  const remove = (id: string) =>
    update((s) => {
      const day = draftDay(s, viewKey);
      day.foods = day.foods.filter((f) => f.id !== id);
    });

  return (
    <View>
      <Card>
        <H2>Add food</H2>
        <Field placeholder="Food (e.g. Oatmeal with banana)" value={form.name} onChangeText={set('name')} />
        {suggestions.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {suggestions.map((n) => (
              <Chip key={n} label={n} onPress={() => pick(n)} />
            ))}
          </View>
        )}
        <Row style={{ marginTop: 10 }}>
          <Field label="kcal" keyboardType="number-pad" value={form.kcal} onChangeText={set('kcal')} />
          <Field label="Protein g" keyboardType="decimal-pad" value={form.protein} onChangeText={set('protein')} />
        </Row>
        <Row style={{ marginTop: 10 }}>
          <Field label="Carbs g" keyboardType="decimal-pad" value={form.carbs} onChangeText={set('carbs')} />
          <Field label="Fat g" keyboardType="decimal-pad" value={form.fat} onChangeText={set('fat')} />
          <Field label="Servings" keyboardType="decimal-pad" value={form.servings} onChangeText={set('servings')} />
        </Row>
        <View style={{ marginTop: 12 }}>
          <Seg value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: m }))} />
        </View>
        <Btn title="Add" onPress={add} disabled={!canAdd} />
      </Card>

      <Card>
        <H2 right={<Text style={{ color: t.text, fontWeight: '700' }}>{fmt(totals(d).kcal)} kcal</Text>}>Food log</H2>
        {d.foods.length === 0 && <Muted>Nothing logged yet.</Muted>}
        {MEALS.map((m) => {
          const items = d.foods.filter((f) => f.meal === m);
          if (!items.length) return null;
          return (
            <View key={m} style={{ marginBottom: 8 }}>
              <Muted style={{ fontWeight: '700', textTransform: 'uppercase', marginTop: 6 }}>
                {m} · {fmt(items.reduce((a, f) => a + f.kcal, 0))} kcal
              </Muted>
              {items.map((f) => (
                <ListRow
                  key={f.id}
                  title={f.name}
                  subtitle={`${fmt(f.kcal)} kcal${f.protein || f.carbs || f.fat ? ` · P ${fmt(f.protein)} · C ${fmt(f.carbs)} · F ${fmt(f.fat)}` : ''}`}
                  onDelete={() => remove(f.id)}
                />
              ))}
            </View>
          );
        })}
      </Card>
    </View>
  );
}
