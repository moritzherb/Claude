'use strict';

/* ---------- Storage ---------- */

const STORAGE_KEY = 'fittrack:v1';

const DEFAULT_STATE = {
  profile: null,
  settings: {
    waterGoalMl: 2500,
    glassMl: 250,
    stepGoal: 10000,
    kcalOverride: null,
    waterReminders: true,
    waterReminderMin: 60,
    stepReminders: true,
    stepReminderMin: 60,
    suppReminders: true,
    activeStart: '08:00',
    activeEnd: '21:00',
    stepSensitivity: 5,
  },
  supplements: [],
  days: {},
  weights: [],
  foodLibrary: {},
  meta: { lastActivity: 0, lastWaterAt: 0, lastWaterNotify: 0, lastStepNotify: 0, suppNotified: {} },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
      meta: { ...DEFAULT_STATE.meta, ...parsed.meta },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadState();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Could not save data on this device');
  }
}

/* ---------- Date helpers ---------- */

const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

const todayKey = () => dateKey();
let viewKey = todayKey();

function day(k = viewKey) {
  if (!state.days[k]) state.days[k] = { water: 0, waterLog: [], steps: 0, foods: [], supps: {} };
  return state.days[k];
}

const minutesOf = (hhmm) => {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return h * 60 + m;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n) => Math.round(n).toLocaleString();
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Calorie calculator ---------- */

function calcPlan(p) {
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

  const proteinPerKg = p.goal === 'maintain' ? 1.6 : 2.0;
  const protein = p.weightKg * proteinPerKg;
  const fat = (target * 0.25) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4);

  const bmi = p.weightKg / (p.heightCm / 100) ** 2;
  let weeks = null;
  if (p.targetWeight && p.goal !== 'maintain' && p.rate > 0) {
    weeks = Math.abs(p.weightKg - p.targetWeight) / p.rate;
  }
  return { bmr, tdee, target, clamped, protein, fat, carbs, bmi, weeks };
}

function calorieTarget() {
  if (state.settings.kcalOverride) return state.settings.kcalOverride;
  const plan = calcPlan(state.profile);
  return plan ? plan.target : 2000;
}

function currentWeight() {
  const last = state.weights[state.weights.length - 1];
  return last ? last.kg : state.profile?.weightKg || 70;
}

// Rough walking estimate: ~0.04 kcal per step for a 70 kg person.
const stepsToKcal = (steps) => steps * 0.04 * (currentWeight() / 70);

/* ---------- Rendering ---------- */

const RING_C = 2 * Math.PI * 50;

function setRing(el, ratio, over = false) {
  el.style.strokeDasharray = RING_C;
  el.style.strokeDashoffset = RING_C * (1 - Math.min(Math.max(ratio, 0), 1));
  el.classList.toggle('over', over);
}

function totals(d) {
  return d.foods.reduce(
    (t, f) => ({
      kcal: t.kcal + f.kcal,
      protein: t.protein + (f.protein || 0),
      carbs: t.carbs + (f.carbs || 0),
      fat: t.fat + (f.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function renderHeader() {
  const isToday = viewKey === todayKey();
  const d = parseKey(viewKey);
  const diff = Math.round((parseKey(todayKey()) - d) / 86400000);
  $('#dateTitle').textContent = isToday ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long' });
  $('#dateSub').textContent = d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  $('#nextDay').disabled = isToday;
}

function renderToday() {
  const d = day();
  const s = state.settings;
  const t = totals(d);
  const target = calorieTarget();

  $('#calVal').textContent = fmt(t.kcal);
  $('#calSub').textContent = `/ ${fmt(target)} kcal`;
  setRing($('#ringCal'), t.kcal / target, t.kcal > target * 1.05);

  $('#stepsVal').textContent = fmt(d.steps);
  $('#stepsSub').textContent = `/ ${fmt(s.stepGoal)}`;
  setRing($('#ringSteps'), d.steps / s.stepGoal);

  $('#waterVal').textContent = fmt(d.water);
  $('#waterSub').textContent = `/ ${fmt(s.waterGoalMl)} ml`;
  setRing($('#ringWater'), d.water / s.waterGoalMl);

  const taken = state.supplements.filter((x) => d.supps[x.id]).length;
  $('#suppsVal').textContent = taken;
  $('#suppsSub').textContent = `/ ${state.supplements.length}`;
  setRing($('#ringSupps'), state.supplements.length ? taken / state.supplements.length : 0);

  // Water glasses
  const glasses = Math.ceil(s.waterGoalMl / s.glassMl);
  let html = '';
  for (let i = 0; i < glasses; i++) {
    const fill = Math.min(Math.max((d.water - i * s.glassMl) / s.glassMl, 0), 1);
    html += `<div class="glass"><i style="height:${fill * 100}%"></i></div>`;
  }
  $('#waterGlasses').innerHTML = html;
  $('#waterUndo').hidden = !d.waterLog.length;
  const left = s.waterGoalMl - d.water;
  $('#waterNext').textContent =
    left > 0 ? `${fmt(left)} ml to go — about ${Math.ceil(left / s.glassMl)} more glass(es).` : 'Water goal reached! 🎉';

  // Energy balance
  const burned = stepsToKcal(d.steps);
  $('#balTarget').textContent = fmt(target);
  $('#balEaten').textContent = fmt(t.kcal);
  $('#balBurned').textContent = fmt(burned);
  const remain = target - t.kcal;
  $('#balRemain').textContent = remain >= 0 ? fmt(remain) : `+${fmt(-remain)} over`;
  $('#balRemain').style.color = remain >= 0 ? '' : 'var(--danger)';

  const plan = calcPlan(state.profile);
  if (plan) {
    const ratio = target / plan.target;
    const macros = [
      ['Protein', t.protein, plan.protein * ratio, '#ef4444'],
      ['Carbs', t.carbs, plan.carbs * ratio, '#eab308'],
      ['Fat', t.fat, plan.fat * ratio, '#3b82f6'],
    ];
    $('#macroBars').innerHTML = macros
      .map(
        ([n, v, g, c]) =>
          `<div class="macro">${n} <span class="muted">${fmt(v)} / ${fmt(g)} g</span><div class="bar"><i style="width:${Math.min((v / g) * 100, 100)}%;background:${c}"></i></div></div>`
      )
      .join('');
  } else {
    $('#macroBars').innerHTML = '';
  }

  $('#setupHint').hidden = !!state.profile;
  renderWeekChart();
}

let chartMetric = 'kcal';

function renderWeekChart() {
  const keys = Array.from({ length: 7 }, (_, i) => addDays(viewKey, i - 6));
  const s = state.settings;
  const cfg = {
    kcal: { val: (k) => totals(state.days[k] || { foods: [] }).kcal, goal: calorieTarget(), color: 'var(--cal)' },
    steps: { val: (k) => state.days[k]?.steps || 0, goal: s.stepGoal, color: 'var(--steps)' },
    water: { val: (k) => state.days[k]?.water || 0, goal: s.waterGoalMl, color: 'var(--water)' },
  }[chartMetric];

  const vals = keys.map(cfg.val);
  const max = Math.max(cfg.goal * 1.15, ...vals, 1);
  const W = 320, H = 150, pad = 18, bw = 28;
  const gap = (W - bw * 7) / 8;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Last 7 days ${chartMetric}">`;
  svg += `<line class="goal-line" x1="0" x2="${W}" y1="${y(cfg.goal)}" y2="${y(cfg.goal)}"/>`;
  svg += `<text x="${W - 2}" y="${y(cfg.goal) - 4}" text-anchor="end">goal ${fmt(cfg.goal)}</text>`;
  keys.forEach((k, i) => {
    const x = gap + i * (bw + gap);
    const v = vals[i];
    const h = Math.max(H - pad - y(v), v ? 2 : 0);
    const label = parseKey(k).toLocaleDateString(undefined, { weekday: 'narrow' });
    svg += `<rect x="${x}" y="${H - pad - h}" width="${bw}" height="${h}" rx="5" fill="${cfg.color}" opacity="${k === viewKey ? 1 : 0.55}"><title>${k}: ${fmt(v)}</title></rect>`;
    svg += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${label}</text>`;
  });
  svg += '</svg>';
  $('#weekChart').innerHTML = svg;
}

function renderFood() {
  const d = day();
  const t = totals(d);
  $('#foodTotal').textContent = `${fmt(t.kcal)} kcal`;
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const html = meals
    .map((m) => {
      const items = d.foods.filter((f) => f.meal === m);
      if (!items.length) return '';
      const sum = items.reduce((a, f) => a + f.kcal, 0);
      return `<div class="meal-group"><h3>${m} · ${fmt(sum)} kcal</h3>${items
        .map(
          (f) => `<div class="row"><div><div>${esc(f.name)}</div><div class="meta">${fmt(f.kcal)} kcal${
            f.protein || f.carbs || f.fat ? ` · P ${fmt(f.protein || 0)} · C ${fmt(f.carbs || 0)} · F ${fmt(f.fat || 0)}` : ''
          }</div></div><button class="del" data-del-food="${f.id}" aria-label="Delete">✕</button></div>`
        )
        .join('')}</div>`;
    })
    .join('');
  $('#foodList').innerHTML = html || '<p class="muted small">Nothing logged yet.</p>';

  $('#foodSuggestions').innerHTML = Object.keys(state.foodLibrary)
    .map((n) => `<option value="${esc(n)}">`)
    .join('');
}

function renderSupps() {
  const d = day();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const isToday = viewKey === todayKey();
  const sorted = [...state.supplements].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

  $('#suppList').innerHTML = sorted
    .map((s) => {
      const taken = !!d.supps[s.id];
      const late = isToday && !taken && s.time && minutesOf(s.time) < nowMin;
      const when = taken ? `✓ ${d.supps[s.id]}` : s.time || '';
      return `<li class="${taken ? 'taken' : ''}"><label><input type="checkbox" data-supp="${s.id}" ${taken ? 'checked' : ''}>
        <span><span class="name">${esc(s.name)}</span>${s.dose ? ` <span class="muted small">${esc(s.dose)}</span>` : ''}</span>
        <span class="when ${late ? 'late' : ''}">${esc(when)}</span></label></li>`;
    })
    .join('');
  $('#suppEmpty').hidden = state.supplements.length > 0;
  const taken = state.supplements.filter((x) => d.supps[x.id]).length;
  $('#suppProgress').textContent = `${taken}/${state.supplements.length}`;

  $('#suppStack').innerHTML = sorted
    .map(
      (s) => `<li class="row"><div><div>${esc(s.name)}</div><div class="meta">${esc(s.dose || '')}${s.dose && s.time ? ' · ' : ''}${
        s.time ? '⏰ ' + s.time : ''
      }</div></div><button class="del" data-del-supp="${s.id}" aria-label="Remove">✕</button></li>`
    )
    .join('');
}

function renderSteps() {
  const d = day();
  const s = state.settings;
  $('#stepsBig').textContent = fmt(d.steps);
  $('#stepsBar').style.width = `${Math.min((d.steps / s.stepGoal) * 100, 100)}%`;
  const km = (d.steps * 0.75) / 1000;
  $('#stepsMeta').textContent = `Goal ${fmt(s.stepGoal)} · ≈ ${km.toFixed(2)} km · ≈ ${fmt(stepsToKcal(d.steps))} kcal`;
}

function renderGoals() {
  const p = state.profile;
  const f = $('#profileForm');
  if (p) {
    for (const k of ['sex', 'age', 'heightCm', 'weightKg', 'goal', 'targetWeight']) if (p[k] != null) f.elements[k].value = p[k];
    f.elements.activity.value = String(p.activity);
    f.elements.rate.value = String(p.rate);
  }
  f.elements.rate.closest('label').hidden = f.elements.goal.value === 'maintain';
  renderCalcResult();

  const sf = $('#settingsForm');
  for (const [k, v] of Object.entries(state.settings)) {
    const el = sf.elements[k];
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
  }
  renderNotifStatus();
  renderWeights();
}

function renderCalcResult() {
  const plan = calcPlan(state.profile);
  const box = $('#calcResult');
  if (!plan) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const bmiCat = plan.bmi < 18.5 ? 'underweight' : plan.bmi < 25 ? 'healthy' : plan.bmi < 30 ? 'overweight' : 'obese';
  box.innerHTML = `
    <div class="stat-grid">
      <div><span class="muted small">BMR</span><strong>${fmt(plan.bmr)}</strong></div>
      <div><span class="muted small">Maintenance</span><strong>${fmt(plan.tdee)}</strong></div>
      <div><span class="muted small">Daily target</span><strong style="color:var(--accent)">${fmt(plan.target)}</strong></div>
      <div><span class="muted small">Protein</span><strong>${fmt(plan.protein)} g</strong></div>
      <div><span class="muted small">Carbs</span><strong>${fmt(plan.carbs)} g</strong></div>
      <div><span class="muted small">Fat</span><strong>${fmt(plan.fat)} g</strong></div>
    </div>
    <p>BMI ${plan.bmi.toFixed(1)} (${bmiCat}).${
      plan.weeks ? ` At this rate you'd reach ${state.profile.targetWeight} kg in about <strong>${Math.ceil(plan.weeks)} weeks</strong>.` : ''
    }</p>
    ${plan.clamped ? '<p style="color:var(--cal)">Target raised to a safe minimum — consider a slower rate.</p>' : ''}
    ${state.settings.kcalOverride ? `<p class="muted">Note: your manual override of ${fmt(state.settings.kcalOverride)} kcal is active.</p>` : ''}
    <p class="muted">Mifflin-St Jeor estimate. Adjust after 2–3 weeks based on your real progress.</p>`;
}

function renderWeights() {
  const w = state.weights;
  const p = state.profile;
  const sum = $('#weightSummary');
  if (!w.length) {
    sum.innerHTML = '<p class="muted">No weigh-ins yet.</p>';
    $('#weightChart').innerHTML = '';
    return;
  }
  const first = w[0].kg;
  const last = w[w.length - 1].kg;
  const change = last - first;
  let txt = `Current <strong>${last} kg</strong> · ${change <= 0 ? '' : '+'}${change.toFixed(1)} kg since ${parseKey(w[0].date).toLocaleDateString()}`;
  if (p?.targetWeight) txt += ` · ${Math.abs(last - p.targetWeight).toFixed(1)} kg to target`;
  sum.innerHTML = `<p>${txt}</p>`;

  const pts = w.slice(-30);
  const vals = pts.map((x) => x.kg).concat(p?.targetWeight ? [p.targetWeight] : []);
  const min = Math.min(...vals) - 1;
  const max = Math.max(...vals) + 1;
  const W = 320, H = 140, pad = 20;
  const x = (i) => pad + (pts.length === 1 ? (W - 2 * pad) / 2 : (i / (pts.length - 1)) * (W - 2 * pad));
  const y = (v) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">`;
  if (p?.targetWeight) {
    svg += `<line class="goal-line" x1="0" x2="${W}" y1="${y(p.targetWeight)}" y2="${y(p.targetWeight)}"/>`;
    svg += `<text x="${W - 2}" y="${y(p.targetWeight) - 4}" text-anchor="end">target ${p.targetWeight}</text>`;
  }
  svg += `<polyline class="weight-line" points="${pts.map((pt, i) => `${x(i)},${y(pt.kg)}`).join(' ')}"/>`;
  pts.forEach((pt, i) => (svg += `<circle class="weight-dot" cx="${x(i)}" cy="${y(pt.kg)}" r="3"><title>${pt.date}: ${pt.kg} kg</title></circle>`));
  svg += `<text x="${pad}" y="${H - 4}">${pts[0].date.slice(5)}</text><text x="${W - pad}" y="${H - 4}" text-anchor="end">${pts[pts.length - 1].date.slice(5)}</text>`;
  svg += '</svg>';
  $('#weightChart').innerHTML = svg;
}

function render() {
  renderHeader();
  renderToday();
  renderFood();
  renderSupps();
  renderSteps();
}

/* ---------- Navigation ---------- */

function showTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  $$('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'goals') renderGoals();
  window.scrollTo({ top: 0 });
}

$$('.bottom-nav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) showTab(g.dataset.goto);
});

$('#prevDay').addEventListener('click', () => {
  viewKey = addDays(viewKey, -1);
  render();
});
$('#nextDay').addEventListener('click', () => {
  if (viewKey < todayKey()) viewKey = addDays(viewKey, 1);
  render();
});

$$('.chart-tabs .chip').forEach((c) =>
  c.addEventListener('click', () => {
    chartMetric = c.dataset.chart;
    $$('.chart-tabs .chip').forEach((x) => x.classList.toggle('active', x === c));
    renderWeekChart();
  })
);

/* ---------- Water ---------- */

function addWater(ml) {
  if (!ml || ml <= 0) return;
  const d = day();
  const before = d.water;
  d.water += ml;
  d.waterLog.push(ml);
  if (viewKey === todayKey()) state.meta.lastWaterAt = Date.now();
  save();
  render();
  if (before < state.settings.waterGoalMl && d.water >= state.settings.waterGoalMl) toast('💧 Water goal reached — nice work!');
  else toast(`+${ml} ml water`);
}

$$('.water-btn').forEach((b) =>
  b.addEventListener('click', () => addWater(b.dataset.ml === 'glass' ? state.settings.glassMl : Number(b.dataset.ml)))
);
$('#waterRingCard').addEventListener('click', () => addWater(state.settings.glassMl));
$('#waterCustom').addEventListener('click', () => {
  const v = Number(prompt('How many ml?', '330'));
  if (v > 0) addWater(v);
});
$('#waterUndo').addEventListener('click', () => {
  const d = day();
  const ml = d.waterLog.pop();
  if (ml == null) return;
  d.water = Math.max(0, d.water - ml);
  save();
  render();
});

/* ---------- Food ---------- */

const foodForm = $('#foodForm');

foodForm.elements.name.addEventListener('change', (e) => {
  const lib = state.foodLibrary[e.target.value];
  if (!lib) return;
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) foodForm.elements[k].value = lib[k] || '';
});

foodForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = foodForm.elements;
  const servings = Number(f.servings.value) || 1;
  const base = {
    kcal: Number(f.kcal.value) || 0,
    protein: Number(f.protein.value) || 0,
    carbs: Number(f.carbs.value) || 0,
    fat: Number(f.fat.value) || 0,
  };
  const name = f.name.value.trim();
  state.foodLibrary[name] = base;
  day().foods.push({
    id: uid(),
    name: servings !== 1 ? `${name} ×${servings}` : name,
    meal: f.meal.value,
    kcal: base.kcal * servings,
    protein: base.protein * servings,
    carbs: base.carbs * servings,
    fat: base.fat * servings,
    at: Date.now(),
  });
  save();
  const meal = f.meal.value;
  foodForm.reset();
  f.meal.value = meal;
  render();
  toast(`Added ${name}`);
});

$('#foodList').addEventListener('click', (e) => {
  const id = e.target.dataset.delFood;
  if (!id) return;
  const d = day();
  d.foods = d.foods.filter((f) => f.id !== id);
  save();
  render();
});

function guessMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 17 ? 'Snack' : h < 21 ? 'Dinner' : 'Snack';
}
foodForm.elements.meal.value = guessMeal();

/* ---------- Supplements ---------- */

$('#suppForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  state.supplements.push({ id: uid(), name: f.name.value.trim(), dose: f.dose.value.trim(), time: f.time.value });
  save();
  e.target.reset();
  render();
});

$('#suppStack').addEventListener('click', (e) => {
  const id = e.target.dataset.delSupp;
  if (!id) return;
  const s = state.supplements.find((x) => x.id === id);
  if (!confirm(`Remove ${s.name} from your stack?`)) return;
  state.supplements = state.supplements.filter((x) => x.id !== id);
  save();
  render();
});

$('#suppList').addEventListener('change', (e) => {
  const id = e.target.dataset.supp;
  if (!id) return;
  const d = day();
  if (e.target.checked) d.supps[id] = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  else delete d.supps[id];
  save();
  render();
  const all = state.supplements.every((x) => d.supps[x.id]);
  if (e.target.checked && all) toast('💊 All supplements taken today!');
});

/* ---------- Steps ---------- */

function addSteps(n, { set = false, key = viewKey } = {}) {
  const d = day(key);
  const before = d.steps;
  d.steps = Math.max(0, set ? n : d.steps + n);
  if (key === todayKey() && d.steps > before) state.meta.lastActivity = Date.now();
  if (before < state.settings.stepGoal && d.steps >= state.settings.stepGoal) toast('👟 Step goal reached!');
}

$('#stepsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const n = Number(e.target.elements.steps.value);
  addSteps(n, { set: e.submitter?.value === 'set' });
  save();
  e.target.reset();
  render();
});

// Accelerometer-based pedometer: detect peaks in the smoothed acceleration magnitude.
const pedometer = {
  running: false,
  smooth: 9.81,
  baseline: 9.81,
  above: false,
  lastStep: 0,
  pending: 0,
  wakeLock: null,
};

function threshold() {
  // Sensitivity 1 (least) .. 10 (most) → threshold 2.2 .. 0.4 m/s²
  return 2.4 - state.settings.stepSensitivity * 0.2;
}

function onMotion(e) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  pedometer.smooth = pedometer.smooth * 0.75 + mag * 0.25;
  pedometer.baseline = pedometer.baseline * 0.98 + mag * 0.02;
  const diff = pedometer.smooth - pedometer.baseline;
  const now = performance.now();
  const thr = threshold();
  if (!pedometer.above && diff > thr) {
    pedometer.above = true;
    if (now - pedometer.lastStep > 280) {
      pedometer.lastStep = now;
      pedometer.pending++;
    }
  } else if (pedometer.above && diff < thr * 0.3) {
    pedometer.above = false;
  }
}

let flushTimer = null;
function flushSteps() {
  if (!pedometer.pending) return;
  addSteps(pedometer.pending, { key: todayKey() });
  pedometer.pending = 0;
  save();
  render();
}

async function startPedometer() {
  if (typeof DeviceMotionEvent === 'undefined') {
    $('#stepStatus').textContent = 'Motion sensors are not available on this device/browser.';
    return;
  }
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') {
        $('#stepStatus').textContent = 'Motion permission was denied.';
        return;
      }
    } catch {
      $('#stepStatus').textContent = 'Could not get motion permission.';
      return;
    }
  }
  window.addEventListener('devicemotion', onMotion);
  pedometer.running = true;
  flushTimer = setInterval(flushSteps, 1500);
  try {
    pedometer.wakeLock = await navigator.wakeLock?.request('screen');
  } catch {}
  updatePedometerUi();

  // Detect desktop / no-sensor case.
  let gotEvent = false;
  const probe = () => (gotEvent = true);
  window.addEventListener('devicemotion', probe, { once: true });
  setTimeout(() => {
    if (pedometer.running && !gotEvent) $('#stepStatus').textContent = 'No motion data received — this device may not have an accelerometer.';
  }, 2500);
}

function stopPedometer() {
  window.removeEventListener('devicemotion', onMotion);
  pedometer.running = false;
  clearInterval(flushTimer);
  flushSteps();
  pedometer.wakeLock?.release().catch(() => {});
  pedometer.wakeLock = null;
  updatePedometerUi();
}

function updatePedometerUi() {
  const b = $('#stepToggle');
  b.textContent = pedometer.running ? '■ Stop step counter' : '▶ Start step counter';
  b.classList.toggle('running', pedometer.running);
  $('#stepStatus').textContent = pedometer.running ? '🟢 Counting steps… keep this screen open.' : '';
}

$('#stepToggle').addEventListener('click', () => (pedometer.running ? stopPedometer() : startPedometer()));

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && pedometer.running && !pedometer.wakeLock) {
    try {
      pedometer.wakeLock = await navigator.wakeLock?.request('screen');
    } catch {}
  }
});

/* ---------- Goals / profile ---------- */

const profileForm = $('#profileForm');
profileForm.elements.goal.addEventListener('change', (e) => {
  profileForm.elements.rate.closest('label').hidden = e.target.value === 'maintain';
});

profileForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = profileForm.elements;
  const prevWeight = state.profile?.weightKg;
  state.profile = {
    sex: f.sex.value,
    age: Number(f.age.value),
    heightCm: Number(f.heightCm.value),
    weightKg: Number(f.weightKg.value),
    activity: Number(f.activity.value),
    goal: f.goal.value,
    rate: f.goal.value === 'maintain' ? 0 : Number(f.rate.value),
    targetWeight: f.targetWeight.value ? Number(f.targetWeight.value) : null,
  };
  if (state.profile.weightKg !== prevWeight) logWeight(state.profile.weightKg);
  save();
  renderGoals();
  render();
  toast(`Daily target: ${fmt(calcPlan(state.profile).target)} kcal`);
});

function logWeight(kg) {
  const k = todayKey();
  const existing = state.weights.find((w) => w.date === k);
  if (existing) existing.kg = kg;
  else state.weights.push({ date: k, kg });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
}

$('#weightForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = Number(e.target.elements.kg.value);
  logWeight(kg);
  if (state.profile) state.profile.weightKg = kg; // keeps calorie target in sync
  save();
  e.target.reset();
  renderGoals();
  render();
  toast(`Logged ${kg} kg`);
});

$('#settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const s = state.settings;
  s.waterGoalMl = Number(f.waterGoalMl.value) || 2500;
  s.glassMl = Number(f.glassMl.value) || 250;
  s.stepGoal = Number(f.stepGoal.value) || 10000;
  s.kcalOverride = Number(f.kcalOverride.value) || null;
  s.waterReminders = f.waterReminders.checked;
  s.waterReminderMin = Number(f.waterReminderMin.value);
  s.stepReminders = f.stepReminders.checked;
  s.stepReminderMin = Number(f.stepReminderMin.value);
  s.suppReminders = f.suppReminders.checked;
  s.activeStart = f.activeStart.value || '08:00';
  s.activeEnd = f.activeEnd.value || '21:00';
  s.stepSensitivity = Number(f.stepSensitivity.value);
  save();
  renderGoals();
  render();
  toast('Settings saved');
  if ((s.waterReminders || s.stepReminders || s.suppReminders) && 'Notification' in window && Notification.permission === 'default') {
    requestNotifications();
  }
});

/* ---------- Data import/export ---------- */

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fittrack-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !data.days) throw new Error('bad');
    if (!confirm('Replace all current data with this backup?')) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    state = loadState();
    renderGoals();
    render();
    toast('Backup restored');
  } catch {
    toast('That file is not a valid FitTrack backup');
  } finally {
    e.target.value = '';
  }
});

$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Delete ALL data on this device? This cannot be undone.')) return;
  state = structuredClone(DEFAULT_STATE);
  save();
  renderGoals();
  render();
});

/* ---------- Notifications & reminders ---------- */

let swReg = null;

function renderNotifStatus() {
  const el = $('#notifStatus');
  const btn = $('#notifBtn');
  if (!('Notification' in window)) {
    el.textContent = 'Notifications are not supported here. On iPhone, add this app to your Home Screen first. In-app reminders still work.';
    btn.hidden = true;
    return;
  }
  const p = Notification.permission;
  btn.hidden = p !== 'default';
  el.textContent =
    p === 'granted'
      ? '🔔 Notifications on. Reminders fire while the app is open or running in the background.'
      : p === 'denied'
      ? 'Notifications are blocked in your browser settings — you will only see in-app reminders.'
      : 'Allow notifications so reminders can reach you.';
}

async function requestNotifications() {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
  renderNotifStatus();
  if (Notification.permission === 'granted') notify('FitTrack', 'Reminders are on 💪', 'test');
}
$('#notifBtn').addEventListener('click', requestNotifications);

function notify(title, body, tag) {
  toast(`${title}: ${body}`, 6000);
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icon.svg', badge: 'icon.svg', renotify: true };
  if (swReg) swReg.showNotification(title, opts).catch(() => new Notification(title, opts));
  else new Notification(title, opts);
}

const sessionStart = Date.now();

function checkReminders() {
  const now = new Date();
  const t = now.getTime();
  const s = state.settings;
  const m = state.meta;
  const k = todayKey();
  const d = day(k);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const active = nowMin >= minutesOf(s.activeStart) && nowMin <= minutesOf(s.activeEnd);
  let changed = false;

  if (active && s.waterReminders && d.water < s.waterGoalMl) {
    const iv = s.waterReminderMin * 60000;
    if (t - Math.max(m.lastWaterAt, m.lastWaterNotify, sessionStart) >= iv) {
      const left = s.waterGoalMl - d.water;
      notify('💧 Time to drink water', `${fmt(left)} ml left to hit today's goal.`, 'water');
      m.lastWaterNotify = t;
      changed = true;
    }
  }

  if (active && s.stepReminders && d.steps < s.stepGoal) {
    const iv = s.stepReminderMin * 60000;
    if (t - Math.max(m.lastActivity, m.lastStepNotify, sessionStart) >= iv) {
      notify('👟 Time to move', `You're at ${fmt(d.steps)} / ${fmt(s.stepGoal)} steps. A short walk helps!`, 'steps');
      m.lastStepNotify = t;
      changed = true;
    }
  }

  if (s.suppReminders) {
    for (const sp of state.supplements) {
      if (!sp.time || d.supps[sp.id]) continue;
      const key = `${k}:${sp.id}`;
      const due = minutesOf(sp.time);
      if (nowMin >= due && nowMin - due < 180 && !m.suppNotified[key]) {
        notify('💊 Supplement time', `Take ${sp.name}${sp.dose ? ` (${sp.dose})` : ''}.`, `supp-${sp.id}`);
        m.suppNotified[key] = true;
        changed = true;
      }
    }
    // prune old keys
    for (const key of Object.keys(m.suppNotified)) if (!key.startsWith(k)) delete m.suppNotified[key];
  }

  if (changed) save();
}

/* ---------- Toast ---------- */

let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- Boot ---------- */

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker
    .register('sw.js')
    .then((r) => (swReg = r))
    .catch(() => {});
}

// Roll over to the new day automatically if the app stays open past midnight.
let lastToday = todayKey();
setInterval(() => {
  const k = todayKey();
  if (k !== lastToday) {
    if (viewKey === lastToday) viewKey = k;
    lastToday = k;
    render();
  }
  checkReminders();
  renderSupps();
}, 30000);

render();
renderGoals();
setTimeout(checkReminders, 3000);
