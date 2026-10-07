import DateTimePicker from '@react-native-community/datetimepicker';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function H2({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.h2Row}>
      <Text style={[styles.h2, { color: t.text }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<any> }) {
  const t = useTheme();
  return <Text style={[{ color: t.muted, fontSize: 13 }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<any> }) {
  const t = useTheme();
  return <Text style={[{ color: t.text, fontSize: 15 }, style]}>{children}</Text>;
}

type BtnKind = 'primary' | 'ghost' | 'danger';

export function Btn({
  title,
  onPress,
  kind = 'primary',
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.accent : 'transparent';
  const fg = kind === 'primary' ? t.accentInk : kind === 'danger' ? t.danger : t.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : t.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ flex: 1, minWidth: 0 }, style]}>
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
        {...props}
      />
    </View>
  );
}

export function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}</Text> : null}
      <View style={[styles.seg, { borderColor: t.border, backgroundColor: t.input }]}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={[styles.segItem, active && { backgroundColor: t.accent }]}
            >
              <Text style={{ color: active ? t.accentInk : t.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? t.accent : t.border, backgroundColor: active ? t.accent : 'transparent' }]}
    >
      <Text style={{ color: active ? t.accentInk : t.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: t.text, fontSize: 15, flex: 1, paddingRight: 12 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.accent, false: t.border }} />
    </View>
  );
}

const toDate = (hhmm: string) => {
  const d = new Date();
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Compact native time picker on iOS, HH:MM text entry elsewhere. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.timeRow}>
        <Text style={{ color: t.text, fontSize: 15 }}>{label}</Text>
        <DateTimePicker
          mode="time"
          display="compact"
          value={toDate(value)}
          onChange={(_, d) => d && onChange(toHHMM(d))}
        />
      </View>
    );
  }
  return <Field label={label} value={value} onChangeText={onChange} placeholder="HH:MM" maxLength={5} />;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }, style]}>{children}</View>;
}

export function ListRow({
  title,
  subtitle,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  onDelete?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.listRow, { borderBottomColor: t.border }]}>
      <View style={{ flex: 1 }}>
        <Body>{title}</Body>
        {subtitle ? <Muted>{subtitle}</Muted> : null}
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel={`Delete ${title}`}>
          <Text style={{ color: t.muted, fontSize: 18, paddingHorizontal: 6 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProgressBar({ ratio, color, height = 8 }: { ratio: number; color: string; height?: number }) {
  const t = useTheme();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.ringBg, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/* ---------- charts ---------- */

export function Ring({
  ratio,
  color,
  value,
  sub,
  title,
  onPress,
  over,
}: {
  ratio: number;
  color: string;
  value: string;
  sub: string;
  title: string;
  onPress?: () => void;
  over?: boolean;
}) {
  const t = useTheme();
  const r = 50;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return (
    <Pressable onPress={onPress} style={[styles.ringCard, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ width: 110, height: 110 }}>
        <Svg width={110} height={110} viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={r} stroke={t.ringBg} strokeWidth={10} fill="none" />
          <Circle
            cx={60}
            cy={60}
            r={r}
            stroke={over ? t.danger : color}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - clamped)}
            transform="rotate(-90 60 60)"
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>{value}</Text>
          <Text style={{ color: t.muted, fontSize: 11 }}>{sub}</Text>
        </View>
      </View>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 14, marginTop: 4 }}>{title}</Text>
    </Pressable>
  );
}

export function BarChart({
  values,
  labels,
  goal,
  color,
  highlight,
}: {
  values: number[];
  labels: string[];
  goal: number;
  color: string;
  highlight: number;
}) {
  const t = useTheme();
  const W = 320, H = 150, pad = 18, bw = 28;
  const max = Math.max(goal * 1.15, ...values, 1);
  const gap = (W - bw * values.length) / (values.length + 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Line x1={0} x2={W} y1={y(goal)} y2={y(goal)} stroke={t.muted} strokeDasharray="4 4" strokeWidth={1} />
      <SvgText x={W - 2} y={y(goal) - 4} fill={t.muted} fontSize={10} textAnchor="end">
        {`goal ${Math.round(goal).toLocaleString('en-US')}`}
      </SvgText>
      {values.map((v, i) => {
        const x = gap + i * (bw + gap);
        const h = Math.max(H - pad - y(v), v ? 2 : 0);
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={H - pad - h} width={bw} height={h} rx={5} fill={color} opacity={i === highlight ? 1 : 0.55} />
            <SvgText x={x + bw / 2} y={H - 4} fill={t.muted} fontSize={10} textAnchor="middle">
              {labels[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function LineChart({ points, target }: { points: { date: string; kg: number }[]; target?: number | null }) {
  const t = useTheme();
  if (!points.length) return null;
  const W = 320, H = 140, pad = 20;
  const vals = points.map((p) => p.kg).concat(target ? [target] : []);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const x = (i: number) => pad + (points.length === 1 ? (W - 2 * pad) / 2 : (i / (points.length - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {target ? (
        <>
          <Line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke={t.muted} strokeDasharray="4 4" />
          <SvgText x={W - 2} y={y(target) - 4} fill={t.muted} fontSize={10} textAnchor="end">{`target ${target}`}</SvgText>
        </>
      ) : null}
      <Polyline points={points.map((p, i) => `${x(i)},${y(p.kg)}`).join(' ')} fill="none" stroke={t.accent} strokeWidth={2} />
      {points.map((p, i) => (
        <Circle key={p.date} cx={x(i)} cy={y(p.kg)} r={3} fill={t.accent} />
      ))}
      <SvgText x={pad} y={H - 4} fill={t.muted} fontSize={10}>{points[0].date.slice(5)}</SvgText>
      <SvgText x={W - pad} y={H - 4} fill={t.muted} fontSize={10} textAnchor="end">
        {points[points.length - 1].date.slice(5)}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  h2Row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: '700' },
  btn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontWeight: '700', fontSize: 15 },
  label: { fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  ringCard: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
