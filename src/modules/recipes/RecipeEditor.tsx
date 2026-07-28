import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useRecipes, useCatalog, type ContentSlot } from '../../lib/content';
import { Field, TextField, SelectField, Toggle, SaveBar } from '../../components/ui';
import { GroupMap } from '../../components/GroupMap';

const blankSlot = (order: number): ContentSlot => ({
  sort_order: order,
  // Muscle is the default primitive — a slot targets a muscle (usually a head like
  // Upper Chest), and the lifter picks the exercise. Switch to Variation only when
  // you want to pin a specific movement pattern (e.g. vertical pull vs. row).
  slot_kind: 'muscle',
  family_key: null,
  muscle_id: null,
  base_sets: 3,
  rep_low: 8,
  rep_high: 12,
  rest_seconds: 90,
  priority: 2,
});

export default function RecipeEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const { recipes, loading, reload } = useRecipes();
  const { catalog } = useCatalog();

  const [dayType, setDayType] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [sortOrder, setSortOrder] = useState(999);
  const [enabled, setEnabled] = useState(true);
  const [slots, setSlots] = useState<ContentSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !recipes) return;
    const r = recipes.find((x) => x.id === id);
    if (r) {
      setDayType(r.day_type);
      setDisplayName(r.display_name);
      setSortOrder(r.sort_order);
      setEnabled(r.enabled);
      setSlots(r.slots.map((s) => ({ ...s })));
    }
  }, [recipes, id, isNew]);

  // Grouped + prefixed by muscle group so a variation is easy to find/identify.
  const familyOptions = useMemo(
    () =>
      [...(catalog?.families ?? [])]
        .sort((a, b) => (a.muscle_group_raw ?? '').localeCompare(b.muscle_group_raw ?? '') || a.display_name.localeCompare(b.display_name))
        .map((f) => ({ value: f.key, label: `${f.muscle_group_raw ?? '?'} · ${f.display_name}` })),
    [catalog]
  );
  const muscleOptions = useMemo(
    () =>
      [...(catalog?.muscles ?? [])]
        .sort((a, b) => a.group_raw.localeCompare(b.group_raw) || a.name.localeCompare(b.name))
        .map((m) => ({ value: m.id, label: `${m.group_raw} · ${m.name}` })),
    [catalog]
  );
  const slotGroup = (s: ContentSlot): string | null =>
    !catalog ? null : s.slot_kind === 'muscle' ? catalog.musclesById.get(s.muscle_id ?? '')?.group_raw ?? null : catalog.familiesByKey.get(s.family_key ?? '')?.muscle_group_raw ?? null;

  const setSlot = (i: number, patch: Partial<ContentSlot>) =>
    setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setSlots((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function save() {
    setError(null);
    if (!dayType.trim()) return setError('Day type is required (e.g. push).');
    if (!displayName.trim()) return setError('Display name is required.');
    setSaving(true);
    const recipeId = isNew ? crypto.randomUUID() : (id as string);

    const { error: rErr } = await supabase.from('content_day_recipes').upsert({
      id: recipeId,
      day_type: dayType.trim(),
      display_name: displayName.trim(),
      sort_order: sortOrder,
      enabled,
    });
    if (rErr) {
      setSaving(false);
      return setError(rErr.message);
    }
    // Replace the recipe's slots (simple + safe for a short list).
    await supabase.from('content_day_recipe_slots').delete().eq('recipe_id', recipeId);
    const rows = slots.map((s, i) => ({
      recipe_id: recipeId,
      sort_order: i,
      slot_kind: s.slot_kind,
      family_key: s.slot_kind === 'variation' ? s.family_key : null,
      muscle_id: s.slot_kind === 'muscle' ? s.muscle_id : null,
      base_sets: s.base_sets,
      rep_low: s.rep_low,
      rep_high: s.rep_high,
      rest_seconds: s.rest_seconds,
      priority: s.priority,
    }));
    if (rows.length) {
      const { error: sErr } = await supabase.from('content_day_recipe_slots').insert(rows);
      if (sErr) {
        setSaving(false);
        return setError(sErr.message);
      }
    }
    setSaving(false);
    nav('/recipes');
  }

  // Fork this recipe into a new day_type (with all its slots) so a split can use
  // a customized copy without touching the shared original. Jumps into the copy.
  async function duplicate() {
    const suggested = `${dayType}_copy`;
    const input = window.prompt('New recipe key (day_type) — lowercase letters, numbers, underscores. This is what a split points at:', suggested);
    if (input == null) return;
    const nt = input.trim();
    if (!/^[a-z][a-z0-9_]*$/.test(nt)) return setError('Key must be lowercase letters/numbers/underscores, starting with a letter (e.g. push_myvariant).');
    if ((recipes ?? []).some((r) => r.day_type === nt)) return setError(`Key "${nt}" already exists.`);

    setSaving(true);
    setError(null);
    const newId = crypto.randomUUID();
    const maxSort = Math.max(0, ...(recipes ?? []).map((r) => r.sort_order));
    const { error: rErr } = await supabase.from('content_day_recipes').insert({
      id: newId, day_type: nt, display_name: `${displayName || dayType} copy`, sort_order: maxSort + 1, enabled: true,
    });
    if (rErr) { setSaving(false); return setError(rErr.message); }
    const rows = slots.map((s, i) => ({
      recipe_id: newId,
      sort_order: i,
      slot_kind: s.slot_kind,
      family_key: s.slot_kind === 'variation' ? s.family_key : null,
      muscle_id: s.slot_kind === 'muscle' ? s.muscle_id : null,
      base_sets: s.base_sets,
      rep_low: s.rep_low,
      rep_high: s.rep_high,
      rest_seconds: s.rest_seconds,
      priority: s.priority,
    }));
    if (rows.length) {
      const { error: sErr } = await supabase.from('content_day_recipe_slots').insert(rows);
      if (sErr) { setSaving(false); return setError(sErr.message); }
    }
    setSaving(false);
    reload();
    nav(`/recipes/${newId}`);
  }

  async function del() {
    if (!confirm(`Delete recipe "${displayName}"?`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_day_recipes').delete().eq('id', id);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/recipes');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{isNew ? 'New recipe' : displayName || 'Edit recipe'}</h1>
        {!isNew && (
          <button
            onClick={duplicate}
            disabled={saving}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Duplicate
          </button>
        )}
      </div>
      <p className="mb-6 text-sm text-slate-500">Order matters: the generator fills a session in rounds by muscle — one exercise per muscle, then a second, etc. — so within each muscle, list your first-choice exercise first. <strong>Editing a recipe changes it for every split that uses it</strong> — use Duplicate to fork a copy for one split.</p>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Field label="Day type" hint="e.g. push, pull, legs">
          <TextField value={dayType} onChange={(e) => setDayType(e.target.value)} disabled={!isNew} placeholder="push" />
        </Field>
        <Field label="Display name">
          <TextField value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Push" />
        </Field>
        <Field label="Sort order">
          <TextField type="number" value={String(sortOrder)} onChange={(e) => setSortOrder(parseInt(e.target.value || '0', 10))} />
        </Field>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-700">Slots</span>
        <button
          onClick={() => setSlots((s) => [...s, blankSlot(s.length)])}
          className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          + Add slot
        </button>
      </div>

      <div className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} className="px-1 text-xs text-slate-400 hover:text-slate-900">▲</button>
                <button onClick={() => move(i, 1)} className="px-1 text-xs text-slate-400 hover:text-slate-900">▼</button>
              </div>
              <GroupMap group={slotGroup(s)} className="size-8 shrink-0 object-contain" />
              <div className="w-28">
                <SelectField value={s.slot_kind} onChange={(v) => setSlot(i, { slot_kind: v as ContentSlot['slot_kind'] })} options={[{ value: 'muscle', label: 'Muscle' }, { value: 'variation', label: 'Variation' }]} />
              </div>
              <div className="flex-1">
                {s.slot_kind === 'variation' ? (
                  <SelectField value={s.family_key ?? ''} onChange={(v) => setSlot(i, { family_key: v || null })} options={familyOptions} placeholder="— pick a variation —" />
                ) : (
                  <SelectField value={s.muscle_id ?? ''} onChange={(v) => setSlot(i, { muscle_id: v || null })} options={muscleOptions} placeholder="— pick a muscle —" />
                )}
              </div>
              <button onClick={() => setSlots((sl) => sl.filter((_, j) => j !== i))} className="px-2 text-sm text-red-500 hover:text-red-700">✕</button>
            </div>
            <div className="mt-2 flex items-center gap-3 pl-9 text-xs text-slate-500">
              <Num label="sets" value={s.base_sets} onChange={(v) => setSlot(i, { base_sets: v })} />
              <Num label="reps" value={s.rep_low} onChange={(v) => setSlot(i, { rep_low: v })} />
              <span>–</span>
              <Num label="" value={s.rep_high} onChange={(v) => setSlot(i, { rep_high: v })} />
              <Num label="rest(s)" value={s.rest_seconds} onChange={(v) => setSlot(i, { rest_seconds: v })} />
              <label className="flex items-center gap-1">
                <span className="text-slate-400">priority</span>
                <select
                  value={String(s.priority)}
                  onChange={(e) => setSlot(i, { priority: Number(e.target.value) })}
                  className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs text-slate-700"
                  title="Lower-priority slots are trimmed first when the session is short on time (e.g. de-emphasize the medial triceps head)."
                >
                  <option value="3">High</option>
                  <option value="2">Normal</option>
                  <option value="1">Low</option>
                </select>
              </label>
            </div>
          </div>
        ))}
        {slots.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">No slots yet — add one.</div>}
      </div>

      <div className="mt-4">
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
      </div>

      <SaveBar onSave={save} onCancel={() => nav('/recipes')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1">
      {label && <span className="text-slate-400">{label}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value || '0', 10))}
        className="w-14 rounded border border-slate-300 px-1.5 py-1 text-sm outline-none focus:border-slate-500"
      />
    </label>
  );
}
