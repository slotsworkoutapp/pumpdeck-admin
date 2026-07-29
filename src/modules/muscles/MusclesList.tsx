import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCatalog } from '../../lib/content';

export default function MusclesList() {
  const { catalog, error, loading } = useCatalog();
  const nav = useNavigate();

  // Count how many exercises target each muscle as a PRIMARY — i.e. the pool
  // that would fill this muscle's slot. (Secondary hits are excluded on purpose;
  // counting them makes Front Delt read as 36 because it's a secondary on every
  // press, which isn't the slot's real pick list.)
  const targetCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of catalog?.exercises ?? []) {
      const ids = [e.primary_muscle_id, ...e.additional_primary_muscle_ids].filter(Boolean) as string[];
      for (const id of new Set(ids)) c.set(id, (c.get(id) ?? 0) + 1);
    }
    return c;
  }, [catalog]);

  // Real trainable muscles first (by sort order), focus muscles pinned to the bottom.
  const orderedMuscles = useMemo(
    () =>
      [...(catalog?.muscles ?? [])].sort(
        (a, b) =>
          (a.group_raw === 'focus' ? 1 : 0) - (b.group_raw === 'focus' ? 1 : 0) ||
          a.sort_order - b.sort_order
      ),
    [catalog]
  );

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!catalog) return null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Muscles</h1>
          <p className="text-sm text-slate-500">{catalog.muscles.length} muscles &amp; focuses</p>
        </div>
        <Link to="/muscles/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          + New muscle
        </Link>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Group</th>
              <th className="px-4 py-2 font-semibold">Body map</th>
              <th className="px-4 py-2 font-semibold" title="Exercises that target this muscle as a primary — its slot's pick list.">Options</th>
              <th className="px-4 py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orderedMuscles.map((m) => (
              <tr key={m.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/muscles/${m.id}`)}>
                <td className="px-4 py-2 font-semibold text-slate-900">
                  {m.name}
                  {!m.enabled && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">off</span>}
                </td>
                <td className="px-4 py-2 text-slate-500">{m.group_raw}</td>
                <td className="px-4 py-2 text-slate-400">{m.body_map_id ?? '—'}</td>
                <td className="px-4 py-2 tabular-nums text-slate-500">{targetCount.get(m.id) ?? 0}</td>
                <td className="max-w-xs truncate px-4 py-2 text-slate-400">{m.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
