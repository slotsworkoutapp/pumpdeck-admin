import { useEffect, useMemo, useState } from 'react';
import { useSplits, useRecipes, useGoals, useCatalog } from '../../lib/content';
import { generateProgram } from '../../lib/generate';
import { SelectField } from '../../components/ui';
import { COVERAGE_GROUPS as GROUPS, GROUP_SHORT as SHORT, SESSION_TIMES, perGroupSets, fairShareFn, BALANCE_FACTOR } from '../../lib/coverage';

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
      const perGroup = perGroupSets(days);
      const emptyDays = days.filter((d) => d.note).map((d) => d.dayName);
      return { key: s.key, name: s.display_name, perGroup, emptyDays };
    });
  }, [splits, recipes, catalog, goal, minutes]);

  if (ls || lr || lg || lc) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Coverage</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Weekly sets per muscle group each split actually delivers <strong>at this session length</strong> — after time-trimming
        and week-aware balancing. <span className="font-semibold text-rose-600">Red</span> = under-served <em>relative to the rest
        of this split</em> (not an absolute minimum), so a small 2-day split reads green as long as it's balanced.
        <span className="text-slate-400"> Grey dash</span> = not trained. Switch session length to see the numbers move.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Session length</span>
          <div className="flex overflow-hidden rounded-lg border border-slate-300">
            {SESSION_TIMES.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={`px-4 py-1.5 text-sm font-semibold ${minutes === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >{m}m</button>
            ))}
          </div>
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
            {rows.map((r) => {
              // Fair share is computed over the groups this split actually trains,
              // so balance is judged among what it trains — not against groups it
              // intentionally skips.
              const fairShare = fairShareFn(r.perGroup);
              return (
              <tr key={r.key} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                {GROUPS.map((g) => {
                  const n = r.perGroup[g] ?? 0;
                  const low = n > 0 && n < BALANCE_FACTOR * fairShare(g);
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
