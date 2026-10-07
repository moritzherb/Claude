import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Btn, Card, Field, H2, ListRow, Muted, ToggleRow, TimeField } from '../components/ui';
import { dateKey, draftDay, getDay, minutesOf, uid, useStore } from '../store';
import { useTheme } from '../theme';

export default function SuppsScreen({ viewKey }: { viewKey: string }) {
  const { state, update } = useStore();
  const t = useTheme();
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [hasTime, setHasTime] = useState(true);
  const [time, setTime] = useState('08:00');
  const d = getDay(state, viewKey);
  const isToday = viewKey === dateKey();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sorted = [...state.supplements].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const taken = state.supplements.filter((x) => d.supps[x.id]).length;

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    update((s) => {
      const day = draftDay(s, viewKey);
      if (day.supps[id]) delete day.supps[id];
      else day.supps[id] = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    });
  };

  const add = () => {
    if (!name.trim()) return;
    update((s) => {
      s.supplements.push({ id: uid(), name: name.trim(), dose: dose.trim(), time: hasTime ? time : '' });
    });
    setName('');
    setDose('');
  };

  const remove = (id: string, n: string) =>
    Alert.alert('Remove supplement', `Remove ${n} from your stack?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => update((s) => void (s.supplements = s.supplements.filter((x) => x.id !== id))) },
    ]);

  return (
    <View>
      <Card>
        <H2 right={<Text style={{ color: t.text, fontWeight: '700' }}>{taken}/{state.supplements.length}</Text>}>
          {isToday ? "Today's supplements" : 'Supplements'}
        </H2>
        {state.supplements.length === 0 && <Muted>No supplements yet — add your stack below.</Muted>}
        {sorted.map((sp) => {
          const done = !!d.supps[sp.id];
          const late = isToday && !done && !!sp.time && minutesOf(sp.time) < nowMin;
          return (
            <Pressable
              key={sp.id}
              onPress={() => toggle(sp.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: t.border }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: done ? t.supps : t.border,
                  backgroundColor: done ? t.supps : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: done ? t.muted : t.text, fontSize: 16, textDecorationLine: done ? 'line-through' : 'none' }}>
                  {sp.name}
                </Text>
                {sp.dose ? <Muted>{sp.dose}</Muted> : null}
              </View>
              <Text style={{ color: late ? t.cal : t.muted, fontSize: 13 }}>{done ? `✓ ${d.supps[sp.id]}` : sp.time}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Card>
        <H2>My stack</H2>
        <Field placeholder="Name (e.g. Vitamin D3)" value={name} onChangeText={setName} />
        <Field placeholder="Dose (e.g. 2000 IU)" value={dose} onChangeText={setDose} style={{ marginTop: 10 }} />
        <ToggleRow label="Remind me at a set time" value={hasTime} onChange={setHasTime} />
        {hasTime && <TimeField label="Time" value={time} onChange={setTime} />}
        <Btn title="Add supplement" onPress={add} disabled={!name.trim()} style={{ marginTop: 12 }} />
        <View style={{ marginTop: 8 }}>
          {sorted.map((sp) => (
            <ListRow
              key={sp.id}
              title={sp.name}
              subtitle={[sp.dose, sp.time && `⏰ ${sp.time}`].filter(Boolean).join(' · ')}
              onDelete={() => remove(sp.id, sp.name)}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}
