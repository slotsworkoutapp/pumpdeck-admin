import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCatalog } from '../../lib/content';

export default function VariationsList() {
  const { catalog, error, loading } = useCatalog();
  const nav = useNavigate();

  const memberCount = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of catalog?.exercises ?? []) {
      if (e.movement_family_key) c.set(e.movement_family_key, (c.get(e.movement_family_key) ?? 0) + 1);
    }
    return c;
  }, [catalog]);

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!catalog) return null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Variations</h1>
          <p className="text-sm text-slate-500">{catalog.families.length} movement families</p>
        </div>
        <Link to="/variations/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          + New variation
        </Link>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Key</th>
              <th className="px-4 py-2 font-semibold">Group</th>
              <th className="px-4 py-2 font-semibold">Exercises</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {catalog.families.map((f) => {
              const n = memberCount.get(f.key) ?? 0;
              return (
                <tr key={f.key} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/variations/${f.key}`)}>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {f.display_name}
                    {!f.enabled && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">off</span>}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">{f.key}</td>
                  <td className="px-4 py-2 text-slate-500">{f.muscle_group_raw ?? '—'}</td>
                  <td className={`px-4 py-2 tabular-nums ${n < 2 ? 'font-semibold text-amber-600' : 'text-slate-500'}`}>{n}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
