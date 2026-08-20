import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCatalog } from '../../lib/content';
import { validateCatalog } from './validate';
import ExerciseTree from './ExerciseTree';
import { GROUP_ORDER, GROUP_COLORS } from '../../lib/bodymap';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/// Null is "all", so the row reads as a filter you turn ON rather than a mode
/// you're always in. 'cooldown' shows as Stretch — same rename as the app.
const KIND_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'normal', label: 'Workout' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Stretch' },
];

export default function ExercisesList() {
  const { catalog, error, loading } = useCatalog();
  const nav = useNavigate();
  const [showIssues, setShowIssues] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  /// Null means every kind. Values match kind_raw; 'cooldown' shows as
  /// "Stretch", the same rename the app and the editor use.
  const [kindFilter, setKindFilter] = useState<string | null>(null);
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
  /// Filter chips: the eight muscle groups, then every training type the
  /// catalog defines, then Cardio.
  ///
  /// Training types were one lumped "Focus" chip, which hid what was actually
  /// in there — Mobility, Plyometrics and Conditioning are as different from
  /// each other as chest is from legs. They're read from the catalog rather
  /// than listed here, so adding a fourth in the Muscles editor gives it a chip
  /// with no code change.
  ///
  /// Cardio isn't a training type at all: it's an exercise TYPE, and most
  /// cardio has no primary muscle. It earns a chip because that's how people
  /// look for it, not because the data groups it that way.
  const chips = useMemo(() => {
    const FOCUS_EMOJI: Record<string, string> = {
      Mobility: '🧘', Plyometrics: '⚡', Conditioning: '🔥',
    };
    const groups = GROUP_ORDER.map((g) => ({
      value: g, label: cap(g), color: GROUP_COLORS[g] ?? '#8B5CF6', map: g, emoji: '',
    }));
    const focuses = (catalog?.muscles ?? [])
      .filter((m) => m.group_raw === 'focus' && m.enabled !== false)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({
        value: `focus:${m.id}`,
        label: m.name,
        color: m.color_hex ?? '#8B5CF6',
        map: null as string | null,
        emoji: FOCUS_EMOJI[m.name] ?? '✨',
      }));
    return [
      ...groups,
      ...focuses,
      { value: 'cardio', label: 'Cardio', color: '#0EA5E9', map: null as string | null, emoji: '🏃' },
    ];
  }, [catalog]);


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

      {/* A second axis, not more chips in the same row. Group answers "where on
          the body", kind answers "when in the session" — combining them is the
          question worth asking here: are there any chest warm-ups at all? */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Type</span>
        {KIND_FILTERS.map((k) => {
          const active = kindFilter === k.value;
          return (
            <button
              key={k.label}
              onClick={() => setKindFilter(active ? null : k.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
              const active = groupFilter === c.value;
              const color = c.color;
              return (
                <button
                  key={c.value}
                  onClick={() => setGroupFilter(active ? null : c.value)}
                  style={active ? { borderColor: color, backgroundColor: `${color}12` } : undefined}
                  className={`flex w-20 flex-col items-center rounded-xl border px-2 py-2 transition ${
                    active ? '' : 'border-slate-200 bg-white opacity-70 hover:opacity-100'
                  }`}
                >
                  {c.map ? (
                    <img src={`/maps/${c.map}.svg`} alt="" className="h-14 w-full object-contain" />
                  ) : (
                    <div className="flex h-14 w-full items-center justify-center text-3xl">{c.emoji}</div>
                  )}
                  <span className="mt-1 text-center text-xs font-semibold leading-tight" style={active ? { color } : { color: '#475569' }}>{c.label}</span>
                </button>
              );
            })}
          </div>
          <ExerciseTree
            catalog={catalog}
            posters={posters}
            groupFilter={groupFilter}
            kindFilter={kindFilter}
            onOpen={(id) => nav(`/exercises/${id}`)}
            onOpenMuscle={(id) => nav(`/muscles/${id}`)}
            onOpenVariation={(key) => nav(`/variations/${key}`)}
          />
    </div>
  );
}
