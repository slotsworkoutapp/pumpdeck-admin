import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCatalog } from '../../lib/content';
import { validateCatalog } from './validate';
import ExerciseTree from './ExerciseTree';
import { GROUP_ORDER, GROUP_COLORS } from '../../lib/bodymap';

export default function ExercisesList() {
  const { catalog, error, loading } = useCatalog();
  const nav = useNavigate();
  const [showIssues, setShowIssues] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [posters, setPosters] = useState<Map<string, string>>(new Map());

  // Signed thumbnail URLs keyed by exercise id, shown as a square in the list.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('default_exercise_media').select('exercise_id, poster_path');
      const withPoster = (data ?? []).filter((d) => d.poster_path) as { exercise_id: string; poster_path: string }[];
      if (!withPoster.length) return setPosters(new Map());
      const { data: signed } = await supabase.storage
        .from('exercise-media')
        .createSignedUrls(withPoster.map((d) => d.poster_path), 3600);
      const m = new Map<string, string>();
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) m.set(withPoster[i].exercise_id, s.signedUrl);
      });
      setPosters(m);
    })();
  }, []);

  const issues = useMemo(() => (catalog ? validateCatalog(catalog) : []), [catalog]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;

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

      <div className="mb-4 flex flex-wrap gap-2">
        {[...GROUP_ORDER, 'focus'].map((g) => {
              const active = groupFilter === g;
              const color = GROUP_COLORS[g] ?? '#8B5CF6';
              return (
                <button
                  key={g}
                  onClick={() => setGroupFilter(active ? null : g)}
                  style={active ? { borderColor: color, backgroundColor: `${color}12` } : undefined}
                  className={`flex w-20 flex-col items-center rounded-xl border px-2 py-2 transition ${
                    active ? '' : 'border-slate-200 bg-white opacity-70 hover:opacity-100'
                  }`}
                >
                  {g === 'focus' ? (
                    <div className="flex h-14 w-full items-center justify-center text-3xl">✨</div>
                  ) : (
                    <img src={`/maps/${g}.svg`} alt="" className="h-14 w-full object-contain" />
                  )}
                  <span className="mt-1 text-xs font-semibold capitalize" style={active ? { color } : { color: '#475569' }}>{g}</span>
                </button>
              );
            })}
          </div>
          <ExerciseTree
            catalog={catalog}
            posters={posters}
            groupFilter={groupFilter}
            onOpen={(id) => nav(`/exercises/${id}`)}
            onOpenMuscle={(id) => nav(`/muscles/${id}`)}
            onOpenVariation={(key) => nav(`/variations/${key}`)}
          />
    </div>
  );
}
