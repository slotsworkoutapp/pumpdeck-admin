import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCatalog, type ContentExercise } from '../../lib/content';
import { validateCatalog } from './validate';
import ExerciseTree from './ExerciseTree';

export default function ExercisesList() {
  const { catalog, error, loading } = useCatalog();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [showIssues, setShowIssues] = useState(false);
  const [view, setView] = useState<'tree' | 'table'>('tree');

  const issues = useMemo(() => (catalog ? validateCatalog(catalog) : []), [catalog]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;

  const rows = useMemo(() => {
    if (!catalog) return [];
    const needle = q.trim().toLowerCase();
    return catalog.exercises
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .map((e) => ({
        e,
        primary: e.primary_muscle_id ? catalog.musclesById.get(e.primary_muscle_id)?.name ?? '—' : '—',
        family: e.movement_family_key ? catalog.familiesByKey.get(e.movement_family_key)?.display_name ?? e.movement_family_key : '—',
        secondary: e.secondary_muscle_ids
          .map((id) => catalog.musclesById.get(id)?.name)
          .filter(Boolean)
          .join(', '),
      }));
  }, [catalog, q]);

  if (loading) return <div className="p-8 text-slate-400">Loading catalog…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!catalog) return null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exercises</h1>
          <p className="text-sm text-slate-500">
            {catalog.exercises.length} exercises · {catalog.families.length} variations ·{' '}
            {catalog.muscles.length} muscles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold">
            {(['tree', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 capitalize ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowIssues((v) => !v)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              errorCount ? 'bg-red-50 text-red-700' : issues.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {errorCount ? `${errorCount} errors` : issues.length ? `${issues.length} warnings` : 'All checks pass'}
            {issues.length ? (showIssues ? ' ▲' : ' ▼') : ' ✓'}
          </button>
          <Link
            to="/muscles/new"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Muscle
          </Link>
          <Link
            to="/variations/new"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Variation
          </Link>
          <Link
            to="/exercises/new"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            + New exercise
          </Link>
        </div>
      </div>

      {showIssues && issues.length > 0 && (
        <div className="mb-4 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100 text-sm">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-3 px-4 py-2">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    i.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {i.severity}
                </span>
                <span className="font-medium text-slate-700">{i.entity}</span>
                <span className="text-slate-500">{i.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === 'tree' ? (
        <ExerciseTree
          catalog={catalog}
          onOpen={(id) => nav(`/exercises/${id}`)}
          onOpenMuscle={(id) => nav(`/muscles/${id}`)}
          onOpenVariation={(key) => nav(`/variations/${key}`)}
        />
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercises…"
            className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Type</th>
              <th className="px-4 py-2 font-semibold">Primary</th>
              <th className="px-4 py-2 font-semibold">Variation</th>
              <th className="px-4 py-2 font-semibold">Secondary</th>
              <th className="px-4 py-2 font-semibold">Rest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ e, primary, family, secondary }) => (
              <Row key={e.id} e={e} primary={primary} family={family} secondary={secondary} onOpen={() => nav(`/exercises/${e.id}`)} />
            ))}
          </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ e, primary, family, secondary, onOpen }: { e: ContentExercise; primary: string; family: string; secondary: string; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer hover:bg-slate-50" onClick={onOpen}>
      <td className="px-4 py-2 font-semibold text-slate-900">
        {e.name}
        {!e.enabled && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">off</span>}
      </td>
      <td className="px-4 py-2 text-slate-500">
        {e.type_raw}
        {e.kind_raw !== 'normal' ? ` · ${e.kind_raw}` : ''}
      </td>
      <td className="px-4 py-2 text-slate-700">{primary}</td>
      <td className="px-4 py-2 text-slate-500">{family}</td>
      <td className="px-4 py-2 text-slate-400">{secondary || '—'}</td>
      <td className="px-4 py-2 tabular-nums text-slate-500">{e.default_rest_seconds}s</td>
    </tr>
  );
}
