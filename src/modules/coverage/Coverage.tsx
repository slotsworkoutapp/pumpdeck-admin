import { useEffect, useMemo, useState } from 'react';
import { useSplits, useRecipes, useGoals, useCatalog } from '../../lib/content';
import { generateProgram } from '../../lib/generate';
import { SelectField } from '../../components/ui';
import { COVERAGE_GROUPS as GROUPS, GROUP_SHORT as SHORT, SESSION_TIMES, perGroupSets, groupTarget, coverageStatus, statusChip } from '../../lib/coverage';

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
        Each cell is <strong>weekly sets delivered / balanced target</strong> for that group at this session length. The target is the
        group's fair (weighted) share of the split's total sets — legs/back heavy, arms light — computed over only the groups it trains,
        so a small balanced split reads on-target. <span className="font-semibold text-rose-600">Red</span> = under,
        <span className="font-semibold text-amber-600"> amber</span> = over (too much).
        <span className="text-slate-400"> Grey dash</span> = not trained.
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
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                {GROUPS.map((g) => {
                  const n = r.perGroup[g] ?? 0;
                  if (n === 0) return <td key={g} className="px-3 py-2 text-center tabular-nums"><span className="text-slate-300">–</span></td>;
                  // Target = the group's balanced share of THIS split's volume.
                  const target = groupTarget(r.perGroup, g);
                  const status = coverageStatus(n, target);
                  return (
                    <td key={g} className="px-3 py-2 text-center tabular-nums">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${statusChip(status)}`}>{n}/{target}</span>
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
