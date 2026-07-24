import { useMemo } from 'react';
import { useSplits, useRecipes, useCatalog, type ContentRecipe } from '../../lib/content';

// Muscle groups in display order + rough weekly-set minimums (MEV-ish). A group
// that a split trains but leaves below its minimum is flagged red.
const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'biceps', 'triceps', 'forearms', 'core'] as const;
const MIN: Record<string, number> = { chest: 10, back: 10, shoulders: 8, legs: 10, biceps: 8, triceps: 8, forearms: 4, core: 6 };
const SHORT: Record<string, string> = { chest: 'Chest', back: 'Back', shoulders: 'Delts', legs: 'Legs', biceps: 'Bis', triceps: 'Tris', forearms: 'Fore', core: 'Core' };

interface Row {
  key: string;
  name: string;
  perGroup: Record<string, number>;
  declared: Set<string>;
  untypedDays: string[]; // day names with no recipe
}

export default function Coverage() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { catalog, loading: lc } = useCatalog();

  const rows = useMemo<Row[]>(() => {
    if (!splits || !recipes || !catalog) return [];
    const byType = new Map<string, ContentRecipe>(recipes.map((r) => [r.day_type, r]));
    const groupOf = (famKey: string) => catalog.familiesByKey.get(famKey)?.muscle_group_raw ?? '?';
    return splits.map((s) => {
      const perGroup: Record<string, number> = {};
      const declared = new Set<string>();
      const untypedDays: string[] = [];
      for (const d of s.day_assignments) {
        d.groups.forEach((g) => declared.add(g));
        const recipe = d.day_type ? byType.get(d.day_type) : undefined;
        if (!recipe) {
          untypedDays.push(d.day_name);
          continue;
        }
        for (const slot of recipe.slots) {
          if (!slot.family_key) continue;
          const g = groupOf(slot.family_key);
          perGroup[g] = (perGroup[g] ?? 0) + slot.base_sets;
        }
      }
      return { key: s.key, name: s.display_name, perGroup, declared, untypedDays };
    });
  }, [splits, recipes, catalog]);

  if (ls || lr || lc) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900">Coverage</h1>
      <p className="mb-5 max-w-2xl text-sm text-slate-500">
        Weekly sets per muscle group for each split, summed from its day recipes (before goal/time adjustments — this is the
        full menu). <span className="font-semibold text-rose-600">Red</span> = the split trains this group but falls below a
        rough weekly minimum. <span className="text-slate-400">Grey dash</span> = not trained by this split.
        Note: <em>legs</em> and <em>back</em> are large groups (quads/hams/glutes/calves; lats/traps/erectors), so high totals there are expected.
      </p>

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
                  const trained = r.declared.has(g);
                  const low = trained && n < (MIN[g] ?? 0);
                  return (
                    <td key={g} className="px-3 py-2 text-center tabular-nums">
                      {!trained && n === 0 ? (
                        <span className="text-slate-300">–</span>
                      ) : (
                        <span
                          className={
                            low
                              ? 'rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700'
                              : 'text-slate-700'
                          }
                        >
                          {n}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-xs">
                  {r.untypedDays.length > 0 ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
                      {r.untypedDays.length} empty day{r.untypedDays.length > 1 ? 's' : ''}: {r.untypedDays.join(', ')}
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
