import { useEffect, useMemo, useState } from 'react';
import { useSplits, useRecipes, useGoals, useCatalog } from '../../lib/content';
import { generateProgram, capacityFor, weekdayLabel, TIME_BRACKETS, type GenDay } from '../../lib/generate';
import { SelectField } from '../../components/ui';

export default function Preview() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();

  const [days, setDays] = useState(3);
  const [bracket, setBracket] = useState('to60');
  const [splitKey, setSplitKey] = useState('');
  const [goalKey, setGoalKey] = useState('');

  const available = useMemo(() => (splits ?? []).filter((s) => s.min_days <= days && days <= s.max_days), [splits, days]);

  // Keep selections valid as inputs change.
  useEffect(() => {
    if (available.length && !available.some((s) => s.key === splitKey)) setSplitKey(available[0].key);
  }, [available, splitKey]);
  useEffect(() => {
    if (goals?.length && !goals.some((g) => g.goal_key === goalKey)) setGoalKey(goals[0].goal_key);
  }, [goals, goalKey]);

  const loading = ls || lr || lg || lc;
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!splits || !recipes || !goals || !catalog) return null;

  const split = available.find((s) => s.key === splitKey);
  const goal = goals.find((g) => g.goal_key === goalKey);
  const ceiling = TIME_BRACKETS.find((b) => b.key === bracket)?.ceiling ?? 60;
  const program = split && goal ? generateProgram(split, recipes, goal, ceiling, catalog) : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Program preview</h1>
      <p className="mb-4 text-sm text-slate-500">
        Exactly what a new user gets for these answers — split × goal × time. Tune recipes/goals and refresh to see changes.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Days / week</span>
          <SelectField value={String(days)} onChange={(v) => setDays(parseInt(v, 10))} options={[2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: `${d} days` }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Session length</span>
          <SelectField value={bracket} onChange={setBracket} options={TIME_BRACKETS.map((b) => ({ value: b.key, label: b.label }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Split</span>
          <SelectField value={splitKey} onChange={setSplitKey} options={available.map((s) => ({ value: s.key, label: s.display_name }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Goal</span>
          <SelectField value={goalKey} onChange={setGoalKey} options={goals.map((g) => ({ value: g.goal_key, label: g.display_name }))} />
        </label>
      </div>

      <p className="mb-3 text-xs text-slate-400">Set budget per day: <strong>{capacityFor(ceiling)}</strong> sets ({ceiling} min ÷ 2.5)</p>

      {!split ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-slate-400">No split for {days} days.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {program.map((d, i) => (
            <DayCard key={i} day={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({ day }: { day: GenDay }) {
  const totalSets = day.slots.reduce((n, s) => n + s.sets, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-bold text-slate-900">
          <span className="text-slate-400">{weekdayLabel(day.weekday)}</span> {day.dayName}
        </span>
        {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{totalSets} sets</span>}
      </div>
      {day.note ? (
        <div className="px-4 py-3 text-sm text-amber-600">{day.note}</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {day.slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
              <span className="flex-1 font-semibold text-slate-800">{s.label}</span>
              {s.kind === 'muscle' && <span className="text-[10px] font-bold uppercase text-indigo-500">muscle</span>}
              <span className="tabular-nums text-slate-500">{s.sets} × {s.repLow}–{s.repHigh}</span>
              <span className="w-12 text-right tabular-nums text-xs text-slate-400">{s.rest}s</span>
            </li>
          ))}
          {day.dropped > 0 && (
            <li className="px-4 py-1.5 text-xs text-slate-400">+{day.dropped} more trimmed to fit the time</li>
          )}
        </ul>
      )}
    </div>
  );
}
