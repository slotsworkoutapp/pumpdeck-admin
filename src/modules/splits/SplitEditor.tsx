import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSplits, useRecipes, useCatalog, type SplitDay, type ContentSlot, type Catalog } from '../../lib/content';
import { Field, TextField, NumberField, SelectField, Toggle, SaveBar } from '../../components/ui';
import { GroupMap } from '../../components/GroupMap';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'];

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

  /// Enabled muscles per group, in the catalog's own order.
  const musclesByGroup = useMemo(() => {
    const m = new Map<string, { id: string; name: string; sort_order: number }[]>();
    for (const mu of catalog?.muscles ?? []) {
      if (mu.enabled === false) continue;
      if (!GROUPS.includes(mu.group_raw)) continue;
      const list = m.get(mu.group_raw) ?? [];
      list.push({ id: mu.id, name: mu.name, sort_order: mu.sort_order });
      m.set(mu.group_raw, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [catalog]);

  /// A day's muscle ids, falling back to expanding its groups for rows written
  /// before per-muscle assignments existed.
  const dayMuscles = (d: SplitDay): string[] => {
    if (d.muscles) return d.muscles;
    return d.groups.flatMap((g) => (musclesByGroup.get(g) ?? []).map((m) => m.id));
  };

  /// `groups` is derived, never edited: it's the set of groups the chosen
  /// muscles belong to, so a coarse consumer still sees something sane.
  const groupsFor = (ids: string[]): string[] => {
    const byId = new Map<string, string>();
    for (const [g, list] of musclesByGroup) for (const m of list) byId.set(m.id, g);
    const gs = new Set(ids.map((id) => byId.get(id)).filter(Boolean) as string[]);
    return GROUPS.filter((g) => gs.has(g));
  };

  const writeMuscles = (i: number, ids: string[]) =>
    setDay(i, { muscles: ids, groups: groupsFor(ids) });

  const toggleMuscle = (i: number, d: SplitDay, id: string) => {
    const cur = dayMuscles(d);
    writeMuscles(i, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const toggleGroup = (i: number, d: SplitDay, members: { id: string }[], on: boolean) => {
    const cur = new Set(dayMuscles(d));
    for (const m of members) on ? cur.add(m.id) : cur.delete(m.id);
    writeMuscles(i, [...cur]);
  };

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

            {/* Muscles this day trains. Per muscle, not per group: front and
                side delt belong to push while rear delt belongs to pull, and
                no group can say that. Click the group map to toggle all of its
                muscles at once — that's the common case — then adjust. */}
            <div className="mt-2 space-y-1">
              {GROUPS.map((g) => {
                const members = musclesByGroup.get(g) ?? [];
                if (!members.length) return null;
                const sel = new Set(dayMuscles(d));
                const allOn = members.every((m) => sel.has(m.id));
                return (
                  <div key={g} className="flex items-start gap-2">
                    <button
                      onClick={() => toggleGroup(i, d, members, !allOn)}
                      title={allOn ? `Remove all ${g}` : `Add all ${g}`}
                      className={`flex w-14 shrink-0 flex-col items-center rounded-lg border px-1 py-1 transition ${
                        members.some((m) => sel.has(m.id)) ? 'border-slate-300 bg-white' : 'border-transparent opacity-30 hover:opacity-60'
                      }`}
                    >
                      <GroupMap group={g} className="size-8 object-contain" />
                      <span className="text-[9px] font-semibold capitalize text-slate-500">{g}</span>
                    </button>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {members.map((m) => {
                        const on = sel.has(m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => toggleMuscle(i, d, m.id)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                              on
                                ? 'border-slate-300 bg-white text-slate-700'
                                : 'border-transparent bg-slate-50 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
