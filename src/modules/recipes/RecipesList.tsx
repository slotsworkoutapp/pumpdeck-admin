import { useNavigate, Link } from 'react-router-dom';
import { useRecipes } from '../../lib/content';

export default function RecipesList() {
  const { recipes, error, loading } = useRecipes();
  const nav = useNavigate();

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!recipes) return null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Day recipes</h1>
          <p className="text-sm text-slate-500">
            What each kind of day is made of. Reused by every split that has that day-type.
          </p>
        </div>
        <Link to="/recipes/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          + New recipe
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {recipes.map((r) => (
          <button
            key={r.id}
            onClick={() => nav(`/recipes/${r.id}`)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-400"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">{r.display_name}</span>
              <span className="text-xs font-semibold text-slate-400">{r.slots.length} slots</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.slots.map((s) => (
                <span
                  key={s.id}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    s.priority === 1 ? 'bg-indigo-100 text-indigo-700' : s.priority === 2 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'
                  }`}
                  title={`priority ${s.priority}`}
                >
                  {s.family_key ?? 'muscle'} · {s.base_sets}×
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
