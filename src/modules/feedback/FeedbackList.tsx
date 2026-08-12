import { useMemo, useState } from 'react';
import { useFeedback, type FeedbackRow } from '../../lib/content';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

type Filter = 'all' | 'bug' | 'feedback';

export default function FeedbackList() {
  const { rows, error, loading, reload } = useFeedback();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const bugs = rows?.filter((r) => r.kind === 'bug').length ?? 0;
    const ideas = rows?.filter((r) => r.kind === 'feedback').length ?? 0;
    return { bugs, ideas, all: bugs + ideas };
  }, [rows]);

  const shown = useMemo(
    () => (rows ?? []).filter((r) => filter === 'all' || r.kind === filter),
    [rows, filter],
  );

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!rows) return null;

  return (
    <div className="p-6">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback</h1>
          <p className="text-sm text-slate-500">
            Sent from Settings → Help in the app. Bug reports carry the app version and device they came from.
          </p>
        </div>
        <button
          onClick={reload}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {(
          [
            ['all', `All (${counts.all})`],
            ['bug', `Bugs (${counts.bugs})`],
            ['feedback', `Ideas (${counts.ideas})`],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-semibold ' +
              (filter === value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {rows.length === 0 ? 'Nothing sent yet.' : 'Nothing in this filter.'}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {shown.map((r) => (
            <FeedbackCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const isBug = row.kind === 'bug';
  const who = row.username ? `@${row.username}` : (row.display_name ?? 'Someone');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className={
              'rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ' +
              (isBug ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')
            }
          >
            {isBug ? 'Bug' : 'Idea'}
          </span>
          <span className="text-sm font-semibold text-slate-900">{who}</span>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{when(row.created_at)}</span>
      </div>

      {/* whitespace-pre-wrap: people write in paragraphs, and collapsing them
          turns a considered report into a wall. */}
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.message}</p>

      {/* Only on bugs. On a feature request the build number is noise. */}
      {isBug && (row.app_version || row.device_model || row.os_version) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {row.app_version && <span>App {row.app_version}</span>}
          {row.os_version && <span>iOS {row.os_version}</span>}
          {row.device_model && <span>{row.device_model}</span>}
        </div>
      )}
    </div>
  );
}
