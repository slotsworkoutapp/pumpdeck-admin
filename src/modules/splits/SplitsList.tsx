import { useNavigate } from 'react-router-dom';
import { useSplits, useRecipes } from '../../lib/content';

const WD = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SplitsList() {
  const { splits, error, loading } = useSplits();
  const { recipes } = useRecipes();
  const nav = useNavigate();

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!splits) return null;

  const recipeTypes = new Set((recipes ?? []).map((r) => r.day_type));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Splits</h1>
          <p className="text-sm text-slate-500">
            The program-type options a user picks from. Each day is tagged with a recipe type (colored = a recipe exists).
          </p>
        </div>
        <button
          onClick={() => nav('/splits/new')}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + New split
        </button>
      </div>

      <div className="space-y-3">
        {splits.map((s) => (
          <button
            key={s.key}
            onClick={() => nav(`/splits/${s.key}`)}
            className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-slate-900">{s.display_name}</span>
              <span className="text-xs font-semibold text-slate-400">{s.min_days} days</span>
            </div>
            {s.blurb && <p className="text-sm text-slate-500">{s.blurb}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.day_assignments.map((d, i) => (
                <span
                  key={i}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    d.day_type && recipeTypes.has(d.day_type)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                  title={d.groups.join(', ')}
                >
                  {WD[d.weekday]}: {d.day_name}
                  {d.day_type ? ` → ${d.day_type}` : ' → (no recipe)'}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
