import { useEffect, useMemo, useState } from 'react';
import { useSplits, useRecipes, useGoals, useCatalog } from '../../lib/content';
import { generateProgram, weekdayLabel, type GenDay } from '../../lib/generate';
import { SelectField } from '../../components/ui';
import { GROUP_ORDER } from '../../lib/bodymap';

const HAS_MAP = new Set<string>(GROUP_ORDER);

export default function Preview() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();

  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(60);
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
  const program = split && goal ? generateProgram(split, recipes, goal, minutes, catalog) : [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Program preview</h1>
      <p className="mb-4 text-sm text-slate-500">
        Exactly what a new user gets for these answers — split × goal × time. Tune recipes/goals and refresh to see changes.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Days / week</span>
          <SelectField value={String(days)} onChange={(v) => setDays(parseInt(v, 10))} options={[2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: `${d} days` }))} />
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

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase text-slate-500">Session length</span>
          <span className="text-lg font-bold tabular-nums text-slate-900">{minutes} min</span>
        </div>
        <input
          type="range"
          min={30}
          max={90}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>30 min</span><span>90 min</span></div>
        <p className="mt-2 text-xs text-slate-400">
          Each day's recipe is filled by priority until this budget is used, counting rest — so strength (long rests) fits fewer exercises than hypertrophy in the same time.
        </p>
      </div>

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
        {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{day.slots.length} ex · {totalSets} sets · ~{day.estMinutes}m</span>}
      </div>
      {day.note ? (
        <div className="px-4 py-3 text-sm text-amber-600">{day.note}</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {day.slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
              {s.group && HAS_MAP.has(s.group) ? (
                <img src={`/maps/${s.group}.svg`} alt="" className="size-8 shrink-0 object-contain" />
              ) : (
                <span className="size-8 shrink-0" />
              )}
              <span className="flex-1 font-semibold text-slate-800">{s.label}</span>
              {s.kind === 'muscle' && <span className="text-[10px] font-bold uppercase text-indigo-500">muscle</span>}
              <span className="tabular-nums text-slate-500">{s.sets} × {s.reps}</span>
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
