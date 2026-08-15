import { Link } from 'react-router-dom';
import { useSnapshotStatus, shortAgo } from '../lib/snapshot';

/// Sidebar pill: does the app's bundled catalog still match this dashboard?
///
/// Amber = you've edited content since the last recorded export, so the next
/// build would ship a stale default library. Green = in line.
///
/// The "Mark exported" click is self-reported — nothing can observe you running
/// `npm run export-snapshot` — so this is a checklist, not a guarantee. It's
/// still worth having: the failure it catches is forgetting entirely, not
/// lying.
export default function SnapshotBadge({ collapsed }: { collapsed: boolean }) {
  const { loading, stale, exportedAt, changed, error } = useSnapshotStatus();

  if (loading || stale === null) return null;

  if (collapsed) {
    return (
      <Link
        to="/snapshot"
        className="flex justify-center py-2"
        title={stale ? 'Snapshot stale — see what changed' : 'Snapshot in line with the catalog'}
      >
        <span className={`size-2.5 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      </Link>
    );
  }

  return (
    <Link
      to="/snapshot"
      className={`mx-2 mb-2 block rounded-lg border p-2.5 text-xs ${stale ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${stale ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        <span className={`font-bold ${stale ? 'text-amber-800' : 'text-slate-600'}`}>
          {stale ? 'Snapshot stale' : 'Snapshot current'}
        </span>
      </div>
      <p className="mt-1 leading-snug text-slate-500">
        {stale ? (
          exportedAt ? (
            <>
              {changed > 0 ? `${changed} ${changed === 1 ? 'edit' : 'edits'} since ` : 'Changed since '}
              the last export ({shortAgo(exportedAt)}). New users won't see them until you export and ship a build.
            </>
          ) : (
            <>No export recorded yet. Run <code className="font-semibold">npm run export-snapshot</code>, then mark it.</>
          )
        ) : (
          <>Exported {exportedAt ? shortAgo(exportedAt) : 'recently'}. A new build would ship today's catalog.</>
        )}
      </p>
      {stale && (
        <p className="mt-2 font-semibold text-amber-700">See what changed →</p>
      )}
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </Link>
  );
}
