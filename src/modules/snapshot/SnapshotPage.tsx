import { useEffect, useState } from 'react';
import { useSnapshotStatus, fetchChangesSince, shortAgo, type ContentChange } from '../../lib/snapshot';

/// What's changed since the last export — the detail behind the sidebar's
/// "Snapshot stale" pill, which could only ever say how many.
///
/// Reached by tapping the pill. Deliberately a page rather than a popover: the
/// list is the thing you read before deciding whether a build is worth cutting,
/// and it can run to dozens of rows after an afternoon of edits.
export default function SnapshotPage() {
  const { loading, stale, exportedAt, changed, marking, error, markExported } = useSnapshotStatus();
  const [changes, setChanges] = useState<ContentChange[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!exportedAt) return;
    fetchChangesSince(exportedAt)
      .then(setChanges)
      .catch((e) => setListError(String(e.message ?? e)));
  }, [exportedAt, changed]);

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  const byEntity = new Map<string, ContentChange[]>();
  for (const c of changes ?? []) {
    if (!byEntity.has(c.entity)) byEntity.set(c.entity, []);
    byEntity.get(c.entity)!.push(c);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className={`size-2.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <h1 className="text-2xl font-bold text-slate-900">
          {stale ? 'Snapshot stale' : 'Snapshot current'}
        </h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        New users seed their library from <code className="font-semibold">content-snapshot.json</code>, which only
        updates when you run <code className="font-semibold">npm run export-snapshot</code> and ship a build.
        {exportedAt ? ` Last export recorded ${shortAgo(exportedAt)}.` : ' No export recorded yet.'}
      </p>

      {stale && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Run <code className="font-semibold">npm run export-snapshot</code>, then mark it here. Until a build
            ships with the new file, everything below reaches new users only if they sync it as a brand-new
            catalog entry — edits to existing exercises don't reach anyone.
          </p>
          <button
            onClick={() => void markExported()}
            disabled={marking}
            className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {marking ? 'Saving…' : 'Mark exported'}
          </button>
        </div>
      )}

      {(error || listError) && <p className="mb-4 text-sm text-red-600">{error ?? listError}</p>}

      {changes && changes.length === 0 && (
        <p className="text-sm text-slate-500">
          Nothing edited since the last export.
          {stale && ' The catalog still differs — something was deleted, which leaves no row to list.'}
        </p>
      )}

      {[...byEntity.entries()].map(([entity, rows]) => (
        <div key={entity} className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">{entity}</span>
            <span className="text-xs font-semibold text-slate-400">{rows.length}</span>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-center justify-between px-4 py-2">
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-xs text-slate-400">{shortAgo(new Date(c.updated_at))}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="mt-6 text-xs text-slate-400">
        Deletions aren't listed — nothing survives to name. They're still detected: staleness compares row counts
        as well as edit times.
      </p>
    </div>
  );
}
