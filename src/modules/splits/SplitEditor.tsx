import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSplits, useRecipes, type SplitDay } from '../../lib/content';
import { Field, TextField, NumberField, SelectField, MultiSelect, Toggle, SaveBar } from '../../components/ui';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'];

export default function SplitEditor() {
  const { key } = useParams();
  const nav = useNavigate();
  const { splits, loading } = useSplits();
  const { recipes } = useRecipes();

  const [displayName, setDisplayName] = useState('');
  const [blurb, setBlurb] = useState('');
  const [days, setDays] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [assignments, setAssignments] = useState<SplitDay[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!splits) return;
    const s = splits.find((x) => x.key === key);
    if (s) {
      setDisplayName(s.display_name);
      setBlurb(s.blurb ?? '');
      setDays(s.min_days);
      setEnabled(s.enabled);
      setAssignments(s.day_assignments.map((d) => ({ ...d })));
    }
  }, [splits, key]);

  const recipeOptions = useMemo(
    () => (recipes ?? []).map((r) => ({ value: r.day_type, label: `${r.display_name} (${r.day_type})` })),
    [recipes]
  );

  const setDay = (i: number, patch: Partial<SplitDay>) =>
    setAssignments((a) => a.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function save() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('content_split_templates').update({
      display_name: displayName.trim(),
      blurb: blurb.trim() || null,
      min_days: days,
      max_days: days,
      enabled,
      day_assignments: assignments,
    }).eq('key', key);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/splits');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{displayName || 'Edit split'}</h1>
      <p className="mb-6 font-mono text-xs text-slate-400">{key}</p>

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
          onClick={() => setAssignments((a) => [...a, { weekday: 2, day_name: '', day_type: null, groups: [] }])}
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
            <div className="mt-2">
              <MultiSelect selected={d.groups} onChange={(v) => setDay(i, { groups: v })} options={GROUPS.map((g) => ({ value: g, label: g }))} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
      </div>

      <SaveBar onSave={save} onCancel={() => nav('/splits')} saving={saving} error={error} />
    </div>
  );
}
