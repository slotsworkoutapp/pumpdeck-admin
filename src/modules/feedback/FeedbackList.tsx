import { useEffect, useMemo, useState } from 'react';
import {
  useFeedback,
  updateFeedback,
  type FeedbackRow,
  type FeedbackStatus,
  type FeedbackPriority,
} from '../../lib/content';
import { supabase } from '../../lib/supabase';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Default view is the worklist: everything not yet finished or waved off. */
type Tab = 'todo' | 'bug' | 'feedback' | 'done' | 'all';

const TABS: [Tab, string][] = [
  ['todo', 'To do'],
  ['bug', 'Bugs'],
  ['feedback', 'Ideas'],
  ['done', 'Closed'],
  ['all', 'All'],
];

const isOpen = (r: FeedbackRow) => r.status === 'new' || r.status === 'open';

function matches(r: FeedbackRow, tab: Tab) {
  switch (tab) {
    case 'todo': return isOpen(r);
    case 'bug': return r.kind === 'bug' && isOpen(r);
    case 'feedback': return r.kind === 'feedback' && isOpen(r);
    case 'done': return !isOpen(r);
    case 'all': return true;
  }
}

export default function FeedbackList() {
  const { rows, error, loading, reload } = useFeedback();
  const [tab, setTab] = useState<Tab>('todo');
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const counts = useMemo(() => {
    const r = rows ?? [];
    return Object.fromEntries(
      TABS.map(([t]) => [t, r.filter((row) => matches(row, t)).length]),
    ) as Record<Tab, number>;
  }, [rows]);

  const shown = useMemo(() => (rows ?? []).filter((r) => matches(r, tab)), [rows, tab]);

  async function patch(row: FeedbackRow, change: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string }) {
    setBusy(row.id);
    try {
      await updateFeedback(row.id, change);
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!rows) return null;

  return (
    <div className="p-6">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback</h1>
          <p className="text-sm text-slate-500">
            Sent from Settings → Contact in the app. Sorted by status, then priority — untriaged and important first.
          </p>
        </div>
        <button
          onClick={reload}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          Refresh
        </button>
      </div>

      {failure && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {failure} <button className="underline" onClick={() => setFailure(null)}>dismiss</button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={
              'rounded-lg px-3 py-1.5 text-sm font-semibold ' +
              (tab === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
            }
          >
            {label} ({counts[value]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {tab === 'todo' ? 'Nothing waiting. 🎉' : 'Nothing here.'}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {shown.map((r) => (
            <FeedbackCard key={r.id} row={r} busy={busy === r.id} onPatch={(c) => patch(r, c)} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  open: 'bg-purple-100 text-purple-700',
  done: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-500',
};
const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'New',
  open: 'Working on it',
  done: 'Done',
  dismissed: 'Dismissed',
};
const PRIORITIES: [FeedbackPriority, string][] = [
  ['high', 'High'],
  ['normal', 'Normal'],
  ['low', 'Low'],
];

function FeedbackCard({
  row,
  busy,
  onPatch,
}: {
  row: FeedbackRow;
  busy: boolean;
  onPatch: (change: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string }) => void;
}) {
  const isBug = row.kind === 'bug';
  const [note, setNote] = useState(row.admin_note ?? '');
  const [editingNote, setEditingNote] = useState(false);
  const closed = !isOpen(row);

  return (
    <div className={'rounded-xl border border-slate-200 bg-white p-4 ' + (closed ? 'opacity-60' : '')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              'rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ' +
              (isBug ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')
            }
          >
            {isBug ? 'Bug' : 'Idea'}
          </span>
          <span className={'rounded-md px-2 py-0.5 text-xs font-semibold ' + STATUS_STYLE[row.status]}>
            {STATUS_LABEL[row.status]}
          </span>
          {row.priority === 'high' && !closed && (
            <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">High</span>
          )}
          <span className="text-sm font-semibold text-slate-900">
            {row.username ? `@${row.username}` : (row.display_name ?? 'Someone')}
          </span>
        </div>
        <span className="shrink-0 text-xs text-slate-400">{when(row.created_at)}</span>
      </div>

      {/* whitespace-pre-wrap: people write in paragraphs, and collapsing them
          turns a considered report into a wall. */}
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{row.message}</p>

      {row.screenshot_path && <Screenshot path={row.screenshot_path} />}

      {/* Only on bugs. On a feature request the build number is noise. */}
      {isBug && (row.app_version || row.device_model || row.os_version) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {row.app_version && <span>App {row.app_version}</span>}
          {row.os_version && <span>iOS {row.os_version}</span>}
          {row.device_model && <span>{row.device_model}</span>}
        </div>
      )}

      {row.admin_note && !editingNote && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-semibold text-slate-500">Note: </span>
          {row.admin_note}
        </div>
      )}

      {editingNote && (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Private note — the sender never sees this."
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => { onPatch({ note }); setEditingNote(false); }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Save note
            </button>
            <button
              onClick={() => { setNote(row.admin_note ?? ''); setEditingNote(false); }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {/* Priority is the ordering control: set it and the list re-sorts
            itself, instead of everything needing re-ranked by hand. */}
        <div className="flex overflow-hidden rounded-lg border border-slate-200">
          {PRIORITIES.map(([value, label]) => (
            <button
              key={value}
              disabled={busy}
              onClick={() => onPatch({ priority: value })}
              className={
                'px-2.5 py-1 text-xs font-semibold ' +
                (row.priority === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grow" />

        {row.status !== 'open' && (
          <Action busy={busy} onClick={() => onPatch({ status: 'open' })}>Working on it</Action>
        )}
        {row.status !== 'done' && (
          <Action busy={busy} onClick={() => onPatch({ status: 'done' })} tone="good">Done</Action>
        )}
        {row.status !== 'dismissed' && (
          <Action busy={busy} onClick={() => onPatch({ status: 'dismissed' })}>Dismiss</Action>
        )}
        {closed && <Action busy={busy} onClick={() => onPatch({ status: 'new' })}>Reopen</Action>}
        {!editingNote && (
          <Action busy={busy} onClick={() => setEditingNote(true)}>
            {row.admin_note ? 'Edit note' : 'Note'}
          </Action>
        )}
      </div>
    </div>
  );
}

/// A submitted screenshot. The bucket is private, so this signs a short-lived
/// URL on mount rather than linking a public one — the picture can contain
/// whatever was on the user's screen when they hit send.
///
/// Click to open full size: the thumbnail is enough to recognise the screen,
/// never enough to read it.
function Screenshot({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(path, 60 * 60);
      if (!alive) return;
      if (error || !data) setFailed(true);
      else setUrl(data.signedUrl);
    })();
    return () => { alive = false; };
  }, [path]);

  if (failed) {
    return <p className="mt-3 text-xs text-slate-400">Screenshot couldn't be loaded.</p>;
  }
  if (!url) {
    return <div className="mt-3 h-28 w-20 animate-pulse rounded-lg bg-slate-100" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
      <img
        src={url}
        alt="Screenshot attached to this feedback"
        className="max-h-40 rounded-lg border border-slate-200 object-contain transition hover:border-slate-300"
      />
    </a>
  );
}

function Action({
  children,
  onClick,
  busy,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone?: 'good';
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={
        'rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ' +
        (tone === 'good'
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200')
      }
    >
      {children}
    </button>
  );
}
