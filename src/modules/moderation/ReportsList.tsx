import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useModerationReports, type ModerationReport } from '../../lib/content';

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ReportsList() {
  const { rows, error, loading, reload } = useModerationReports();
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!rows) return null;

  async function act(key: string, fn: string, params: Record<string, unknown>, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    setBusy(key);
    const { error } = await supabase.rpc(fn, params);
    setBusy(null);
    if (error) alert(error.message);
    else reload();
  }

  // Reported exercise → strip the VIDEO/media everywhere it's been added (the
  // exercise stays as a placeholder + the owner sees a "video removed" note).
  // We do NOT delete the exercise itself.
  const removeMedia = (r: ModerationReport) =>
    act(r.report_id + ':media', 'mod_remove_media_everywhere', { p_owner: r.exercise_owner_id, p_exercise: r.exercise_id },
      `Remove the video from this exercise everywhere it's been added? The exercise stays as a placeholder and the owner is notified in-app.`);
  const addStrike = (r: ModerationReport) =>
    act(r.report_id + ':strike', 'mod_record_strike', { p_user: r.target_user_id },
      `Add a copyright strike to @${r.target_username ?? '—'}? They currently have ${r.target_strikes}.`);
  const takeDown = (r: ModerationReport) =>
    act(r.report_id + ':down', 'mod_take_down_user', { p_user: r.target_user_id },
      `Take down @${r.target_username ?? '—'}? Hides their profile and unpublishes ALL their shared exercises.`);

  return (
    <div className="p-6">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Moderation</h1>
          <p className="text-sm text-slate-500">
            User reports of shared exercises and lifters. Act on valid ones — remove content, add a copyright strike, or take down the account.
          </p>
        </div>
        <button onClick={reload} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          No open reports. 🎉
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.report_id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.kind === 'user' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'}`}>
                      {r.kind === 'user' ? 'Lifter' : 'Exercise'}
                    </span>
                    <span className="font-semibold text-slate-900">{r.reason}</span>
                    <span className="text-xs text-slate-400">{when(r.created_at)}</span>
                  </div>
                  {r.details && <p className="mt-1 text-sm text-slate-600">{r.details}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    Target: <span className="font-semibold text-slate-700">@{r.target_username ?? r.target_user_id?.slice(0, 8) ?? '—'}</span>
                    {r.target_display_name ? ` (${r.target_display_name})` : ''}
                    {' · '}
                    <StrikeBadge count={r.target_strikes} />
                    {r.reporter_username && <span className="text-slate-400"> · reported by @{r.reporter_username}</span>}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {r.kind === 'exercise' && r.exercise_id && (
                    <button
                      disabled={busy === r.report_id + ':media'}
                      onClick={() => removeMedia(r)}
                      className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                    >
                      Remove media
                    </button>
                  )}
                  <button
                    disabled={!r.target_user_id || busy === r.report_id + ':strike'}
                    onClick={() => addStrike(r)}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    + Copyright strike
                  </button>
                  <button
                    disabled={!r.target_user_id || busy === r.report_id + ':down'}
                    onClick={() => takeDown(r)}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Take down user
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Strikes drive the repeat-infringer policy — a user who reaches 3 copyright strikes should be taken down (per your Terms). Removing media
        strips the video everywhere the exercise was added (leaving a placeholder + a "video removed" note to the owner); taking down a user hides
        their profile and unpublishes all their shared content.
      </p>
    </div>
  );
}

function StrikeBadge({ count }: { count: number }) {
  const danger = count >= 3;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${danger ? 'bg-red-100 text-red-700' : count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
      {count} strike{count === 1 ? '' : 's'}
    </span>
  );
}
