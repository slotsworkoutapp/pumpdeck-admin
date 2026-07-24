import { useEffect, useRef, useState } from 'react';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';

// Official demo media for a default exercise: one video + its poster, stored in
// the default/ prefix of the exercise-media bucket and catalogued in
// default_exercise_media (world-readable; admin-write via 0114). Keyed by the
// exercise's deterministic id, so it matches the user's local copy on sync.
const NS = '9e1b7c42-1f3a-4d58-9a2e-6c0b5d8f44a1'; // == SeedID namespace
const BUCKET = 'exercise-media';

interface MediaRow {
  id: string;
  exercise_id: string;
  storage_path: string | null;
  poster_path: string | null;
  type_raw: string;
  sort_order: number;
}

export default function ExerciseMedia({ exerciseId }: { exerciseId: string }) {
  const [row, setRow] = useState<MediaRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'video' | 'poster' | 'remove' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const posterInput = useRef<HTMLInputElement>(null);

  async function signed(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  async function load() {
    const { data } = await supabase
      .from('default_exercise_media')
      .select('*')
      .eq('exercise_id', exerciseId)
      .order('sort_order')
      .limit(1);
    const r = (data?.[0] as MediaRow) ?? null;
    setRow(r);
    setVideoUrl(await signed(r?.storage_path));
    setPosterUrl(await signed(r?.poster_path));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseId]);

  async function upload(kind: 'video' | 'poster', file: File) {
    setErr(null);
    setBusy(kind);
    const ext = (file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
    const path = kind === 'video' ? `default/${exerciseId}.${ext}` : `default/${exerciseId}-poster.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) {
      setErr(up.error.message);
      setBusy(null);
      return;
    }
    const id = row?.id ?? uuidv5(exerciseId, NS);
    const record: MediaRow = {
      id,
      exercise_id: exerciseId,
      type_raw: 'video',
      sort_order: 0,
      storage_path: kind === 'video' ? path : row?.storage_path ?? null,
      poster_path: kind === 'poster' ? path : row?.poster_path ?? null,
    };
    const { error } = await supabase.from('default_exercise_media').upsert(record);
    if (error) setErr(error.message);
    setBusy(null);
    await load();
  }

  async function removeAll() {
    if (!row) return;
    if (!confirm('Remove the video and poster for this exercise?')) return;
    setBusy('remove');
    const paths = [row.storage_path, row.poster_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from('default_exercise_media').delete().eq('id', row.id);
    setBusy(null);
    await load();
  }

  async function removePoster() {
    if (!row?.poster_path) return;
    setBusy('remove');
    await supabase.storage.from(BUCKET).remove([row.poster_path]);
    await supabase.from('default_exercise_media').update({ poster_path: null }).eq('id', row.id);
    setBusy(null);
    await load();
  }

  const hasVideo = !!row?.storage_path;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">Demo media</h3>
        {row && (
          <button onClick={removeAll} disabled={!!busy} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">
            Remove all
          </button>
        )}
      </div>

      {err && <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}

      <div className="grid grid-cols-2 gap-4">
        {/* Video */}
        <div>
          <div className="mb-1 text-xs font-semibold text-slate-500">Video</div>
          <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5">
            {videoUrl ? (
              <video src={videoUrl} poster={posterUrl ?? undefined} controls className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center text-xs text-slate-400">No video</div>
            )}
          </div>
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload('video', e.target.files[0])}
          />
          <button
            onClick={() => videoInput.current?.click()}
            disabled={!!busy}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'video' ? 'Uploading…' : hasVideo ? 'Replace video' : 'Upload video'}
          </button>
        </div>

        {/* Poster */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Thumbnail</span>
            {row?.poster_path && (
              <button onClick={removePoster} disabled={!!busy} className="text-[10px] font-semibold text-rose-600 hover:underline disabled:opacity-50">
                remove
              </button>
            )}
          </div>
          <div className="aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5">
            {posterUrl ? (
              <img src={posterUrl} alt="" className="size-full object-contain" />
            ) : (
              <div className="grid size-full place-items-center text-xs text-slate-400">No thumbnail</div>
            )}
          </div>
          <input
            ref={posterInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload('poster', e.target.files[0])}
          />
          <button
            onClick={() => posterInput.current?.click()}
            disabled={!!busy || !hasVideo}
            title={hasVideo ? undefined : 'Upload a video first'}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'poster' ? 'Uploading…' : row?.poster_path ? 'Replace thumbnail' : 'Upload thumbnail'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Stored in <code className="text-slate-500">default/</code> and delivered to every user's copy of this exercise on sync.
      </p>
    </div>
  );
}
