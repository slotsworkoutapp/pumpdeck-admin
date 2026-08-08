import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSplits, useRecipes, useCatalog, type SplitDay, type ContentSlot, type Catalog } from '../../lib/content';
import { Field, TextField, NumberField, SelectField, Toggle, SaveBar } from '../../components/ui';
import { GroupMap } from '../../components/GroupMap';
import { MusclePicker, orderedMuscles, groupsForMuscles, musclesForGroups } from '../../components/MusclePicker';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const slotGroup = (s: ContentSlot, c: Catalog): string | null =>
  s.slot_kind === 'muscle' ? c.musclesById.get(s.muscle_id ?? '')?.group_raw ?? null : c.familiesByKey.get(s.family_key ?? '')?.muscle_group_raw ?? null;
const slotLabel = (s: ContentSlot, c: Catalog): string =>
  s.slot_kind === 'muscle' ? c.musclesById.get(s.muscle_id ?? '')?.name ?? 'Muscle' : c.familiesByKey.get(s.family_key ?? '')?.display_name ?? '?';

export default function SplitEditor() {
  const { key } = useParams();
  // The "new" route has no `:key` param, so `key` is undefined there — treat a
  // missing key as new too, else "create" silently hits the update path.
  const isNew = !key || key === 'new';
  const nav = useNavigate();
  const { splits, loading } = useSplits();
  const { recipes } = useRecipes();
  const { catalog } = useCatalog();
  const recipeByType = useMemo(() => new Map((recipes ?? []).map((r) => [r.day_type, r])), [recipes]);

  const [newKey, setNewKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [days, setDays] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [assignments, setAssignments] = useState<SplitDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !splits) return;
    const s = splits.find((x) => x.key === key);
    if (s) {
      setDisplayName(s.display_name);
      setBlurb(s.blurb ?? '');
      setDays(s.min_days);
      setEnabled(s.enabled);
      setAssignments(s.day_assignments.map((d) => ({ ...d })));
    }
  }, [splits, key, isNew]);

  const recipeOptions = useMemo(
    () => (recipes ?? []).map((r) => ({ value: r.day_type, label: `${r.display_name} (${r.day_type})` })),
    [recipes]
  );

  const setDay = (i: number, patch: Partial<SplitDay>) =>
    setAssignments((a) => a.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const allMuscles = useMemo(() => orderedMuscles(catalog?.muscles), [catalog]);

  /// A day's muscle ids, expanding its groups for rows written before
  /// per-muscle assignments existed (migration 0153).
  const dayMuscles = (d: SplitDay): string[] => d.muscles ?? musclesForGroups(allMuscles, d.groups);

  /// `groups` is derived from the chosen muscles, never edited directly.
  const writeMuscles = (i: number, ids: string[]) =>
    setDay(i, { muscles: ids, groups: groupsForMuscles(allMuscles, ids) });

  async function save() {
    setError(null);
    if (!displayName.trim()) return setError('Display name is required.');
    const payload = {
      display_name: displayName.trim(),
      blurb: blurb.trim() || null,
      min_days: days,
      max_days: days,
      enabled,
      day_assignments: assignments,
    };
    setSaving(true);
    let error;
    if (isNew) {
      const k = newKey.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)) {
        setSaving(false);
        return setError('Key must start with a letter and contain only letters/numbers, no spaces (e.g. sixPushPullArms).');
      }
      if ((splits ?? []).some((s) => s.key === k)) {
        setSaving(false);
        return setError(`Key "${k}" already exists.`);
      }
      const maxSort = Math.max(0, ...(splits ?? []).map((s) => s.sort_order));
      ({ error } = await supabase.from('content_split_templates').insert({ key: k, sort_order: maxSort + 1, ...payload }));
    } else {
      ({ error } = await supabase.from('content_split_templates').update(payload).eq('key', key));
    }
    setSaving(false);
    if (error) setError(error.message);
    else nav('/splits');
  }

  async function del() {
    if (!confirm(`Delete split "${displayName}"? This can't be undone.`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_split_templates').delete().eq('key', key);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/splits');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{isNew ? 'New split' : displayName || 'Edit split'}</h1>
      {isNew ? (
        <div className="mb-6 mt-2">
          <Field label="Key" hint="letters/numbers, no spaces — the app matches splits on this and it can't change later">
            <TextField value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="sixPushPullArms" />
          </Field>
        </div>
      ) : (
        <p className="mb-6 font-mono text-xs text-slate-400">{key}</p>
      )}

      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Display name">
              <TextField value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
          </div>
          <Field label="Days / week">
            <NumberField value={days} onChange={(e) => setDays(parseInt(e.target.value || '0', 10))} />
          </Field>
        </div>
        <Field label="Blurb">
          <TextField value={blurb} onChange={(e) => setBlurb(e.target.value)} />
        </Field>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">Days</span>
        <button
          onClick={() => setAssignments((a) => [...a, { weekday: 2, day_name: '', day_type: null, groups: [], muscles: [] }])}
          className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          + Add day
        </button>
      </div>

      <div className="space-y-3">
        {assignments.map((d, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="w-24">
                <SelectField
                  value={String(d.weekday)}
                  onChange={(v) => setDay(i, { weekday: parseInt(v, 10) })}
                  options={WD.map((w, idx) => ({ value: String(idx + 1), label: w }))}
                />
              </div>
              <div className="flex-1">
                <TextField value={d.day_name} onChange={(e) => setDay(i, { day_name: e.target.value })} placeholder="Day name (e.g. Push Day)" />
              </div>
              <div className="w-52">
                <SelectField value={d.day_type ?? ''} onChange={(v) => setDay(i, { day_type: v || null })} options={recipeOptions} placeholder="— no recipe —" />
              </div>
              <button onClick={() => setAssignments((a) => a.filter((_, j) => j !== i))} className="px-2 text-sm text-red-500 hover:text-red-700">✕</button>
            </div>

            {/* What the selected recipe actually builds */}
            {d.day_type && recipeByType.get(d.day_type) && catalog && (
              <div className="mt-2 flex flex-wrap gap-1">
                {recipeByType.get(d.day_type)!.slots.map((sl, k) => (
                  <span key={k} className="flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
                    <GroupMap group={slotGroup(sl, catalog)} className="size-4 object-contain" />
                    {slotLabel(sl, catalog)}
                  </span>
                ))}
              </div>
            )}

            {/* Muscles this day trains — same row as the program preview. */}
            <div className="mt-2">
              <MusclePicker
                all={allMuscles}
                value={dayMuscles(d)}
                onChange={(ids) => writeMuscles(i, ids)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
      </div>

      <SaveBar onSave={save} onCancel={() => nav('/splits')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
