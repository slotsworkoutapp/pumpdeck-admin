import { useEffect, useMemo, useState } from 'react';
import { useSplits, useRecipes, useGoals, useCatalog } from '../../lib/content';
import { generateProgram } from '../../lib/generate';
import { SelectField } from '../../components/ui';

// Muscle groups in display order + rough weekly-set minimums (MEV-ish). A group
// that a split trains but leaves below its minimum is flagged red.
const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'biceps', 'triceps', 'forearms', 'core'] as const;
const MIN: Record<string, number> = { chest: 10, back: 10, shoulders: 8, legs: 10, biceps: 8, triceps: 8, forearms: 4, core: 6 };
const SHORT: Record<string, string> = { chest: 'Chest', back: 'Back', shoulders: 'Delts', legs: 'Legs', biceps: 'Bis', triceps: 'Tris', forearms: 'Fore', core: 'Core' };

interface Row {
  key: string;
  name: string;
  perGroup: Record<string, number>;
  emptyDays: string[];
}

export default function Coverage() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();

  const [minutes, setMinutes] = useState(60);
  const [goalKey, setGoalKey] = useState('');
  useEffect(() => {
    if (goals?.length && !goals.some((g) => g.goal_key === goalKey)) setGoalKey(goals[0].goal_key);
  }, [goals, goalKey]);

  const goal = goals?.find((g) => g.goal_key === goalKey);

  // Actual weekly sets per group at the chosen session length — i.e. what a user
  // really gets after time-trimming + week-aware balancing, not the full menu.
  const rows = useMemo<Row[]>(() => {
    if (!splits || !recipes || !catalog || !goal) return [];
    return splits.map((s) => {
      const days = generateProgram(s, recipes, goal, minutes, catalog);
      const perGroup: Record<string, number> = {};
      const emptyDays: string[] = [];
      for (const d of days) {
        if (d.note) emptyDays.push(d.dayName);
        for (const slot of d.slots) if (slot.group) perGroup[slot.group] = (perGroup[slot.group] ?? 0) + slot.sets;
      }
      return { key: s.key, name: s.display_name, perGroup, emptyDays };
    });
  }, [splits, recipes, catalog, goal, minutes]);

  if (ls || lr || lg || lc) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Coverage</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Weekly sets per muscle group each split actually delivers <strong>at this session length</strong> — after time-trimming
        and week-aware balancing. <span className="font-semibold text-rose-600">Red</span> = trained but below a rough weekly
        minimum. <span className="text-slate-400">Grey dash</span> = not trained. Drag the slider to see the numbers move.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="w-80 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Session length</span>
            <span className="text-base font-bold tabular-nums text-slate-900">{minutes} min</span>
          </div>
          <input type="range" min={30} max={90} step={1} value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value, 10))} className="w-full accent-indigo-600" />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Goal</span>
          <SelectField value={goalKey} onChange={setGoalKey} options={(goals ?? []).map((g) => ({ value: g.goal_key, label: g.display_name }))} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-3 py-2 font-semibold text-slate-600">Split</th>
              {GROUPS.map((g) => (
                <th key={g} className="px-3 py-2 text-center font-semibold text-slate-600">{SHORT[g]}</th>
              ))}
              <th className="px-3 py-2 font-semibold text-slate-600">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                {GROUPS.map((g) => {
                  const n = r.perGroup[g] ?? 0;
                  const low = n > 0 && n < (MIN[g] ?? 0);
                  return (
                    <td key={g} className="px-3 py-2 text-center tabular-nums">
                      {n === 0 ? (
                        <span className="text-slate-300">–</span>
                      ) : (
                        <span className={low ? 'rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700' : 'text-slate-700'}>{n}</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-xs">
                  {r.emptyDays.length > 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
                      {r.emptyDays.length} empty day{r.emptyDays.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-emerald-600">✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
