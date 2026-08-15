import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/// Is the app's bundled `content-snapshot.json` still in line with the catalog?
///
/// The app seeds a new user's library from that file, and it only reaches them
/// in a build — so a catalog edit made after the last export is invisible until
/// someone runs `npm run export-snapshot` and ships. This is the thing that
/// notices.
///
/// Staleness is decided by `content_signature()`, a fingerprint of row counts
/// AND max(updated_at) across every content table. Counts matter because a
/// DELETE leaves no timestamp behind: a snapshot that still contains a deleted
/// exercise is stale, and a max(updated_at) check alone would call it clean.
///
/// The export script runs on the anon key and can't write, so "Mark exported"
/// is clicked here, where an admin session satisfies the write policy.
export interface SnapshotStatus {
  loading: boolean;
  /// True when the catalog has drifted from the last recorded export. Null
  /// while loading, or if the status can't be read.
  stale: boolean | null;
  /// When the last export was recorded. Null = never recorded (first run).
  exportedAt: Date | null;
  /// Rows touched since that export. Undercounts deletions — informational.
  changed: number;
  marking: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markExported: () => Promise<void>;
}

export function useSnapshotStatus(): SnapshotStatus {
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [stale, setStale] = useState<boolean | null>(null);
  const [exportedAt, setExportedAt] = useState<Date | null>(null);
  const [changed, setChanged] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [sig, state] = await Promise.all([
      supabase.rpc('content_signature'),
      supabase.from('content_snapshot_state').select('exported_at, signature').maybeSingle(),
    ]);
    if (sig.error || state.error) {
      setError(sig.error?.message ?? state.error?.message ?? null);
      setStale(null);
      setLoading(false);
      return;
    }
    setError(null);
    const row = state.data as { exported_at: string; signature: string } | null;
    const at = row ? new Date(row.exported_at) : null;
    setExportedAt(at);
    // Never exported → treat as stale. That's the honest read: nobody has
    // confirmed the bundled file matches anything.
    setStale(!row || row.signature !== sig.data);
    if (at) {
      const { data } = await supabase.rpc('content_changed_since', { since: at.toISOString() });
      setChanged(typeof data === 'number' ? data : 0);
    } else {
      setChanged(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markExported = useCallback(async () => {
    setMarking(true);
    setError(null);
    const { data: sig, error: sigErr } = await supabase.rpc('content_signature');
    if (sigErr) {
      setError(sigErr.message);
      setMarking(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error: upErr } = await supabase.from('content_snapshot_state').upsert({
      id: true,
      exported_at: new Date().toISOString(),
      exported_by: userData.user?.id ?? null,
      signature: sig,
    });
    setMarking(false);
    if (upErr) return setError(upErr.message);
    await refresh();
  }, [refresh]);

  return { loading, stale, exportedAt, changed, marking, error, refresh, markExported };
}

/// One row changed since the last export.
export interface ContentChange {
  entity: string;
  name: string;
  updated_at: string;
}

/// Everything edited since `since`, newest first. Inserts and updates only —
/// a delete leaves no row to list, which is why staleness is decided by the
/// signature (row counts included) rather than by this.
export async function fetchChangesSince(since: Date): Promise<ContentChange[]> {
  const { data, error } = await supabase.rpc('content_changes_since', {
    since: since.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentChange[];
}

/// "3 minutes ago" / "Aug 14" — short enough for a sidebar pill.
export function shortAgo(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
