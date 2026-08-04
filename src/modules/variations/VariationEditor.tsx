import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCatalog, type ContentFamily } from '../../lib/content';
import { Field, TextField, NumberField, SelectField, Toggle, SaveBar } from '../../components/ui';

const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'];

const blank: ContentFamily = {
  key: '',
  display_name: '',
  muscle_group_raw: 'chest',
  sort_order: 999,
  enabled: true,
};

export default function VariationEditor() {
  const { key } = useParams();
  // The "new" route has no `:key` param, so `key` is undefined there — treat a
  // missing key as new too, else "create" silently hits the update path.
  const isNew = !key || key === 'new';
  const nav = useNavigate();
  const { catalog, loading } = useCatalog();

  const [form, setForm] = useState<ContentFamily>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !catalog) return;
    const f = catalog.families.find((x) => x.key === key);
    if (f) setForm(f);
  }, [catalog, key, isNew]);

  // Member exercises (membership lives on the exercise's movement_family_key).
  const members = useMemo(
    () => (catalog?.exercises ?? []).filter((e) => e.movement_family_key === (isNew ? '' : key)),
    [catalog, key, isNew]
  );

  const set = <K extends keyof ContentFamily>(k: K, v: ContentFamily[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError(null);
    if (!form.key.trim()) return setError('Key is required (e.g. chest.new_press).');
    if (!form.display_name.trim()) return setError('Display name is required.');
    setSaving(true);
    const { error } = await supabase.from('content_families').upsert({
      ...form,
      key: form.key.trim(),
      display_name: form.display_name.trim(),
    });
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  async function del() {
    if (!confirm(`Delete variation "${form.display_name}"? Exercises keep their key but lose this label.`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_families').delete().eq('key', key);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{isNew ? 'New variation' : form.display_name || 'Edit variation'}</h1>
      <div className="space-y-4">
        <Field label="Key" hint={isNew ? 'Stable id, e.g. chest.incline_press — pick carefully, it can’t change later.' : 'Fixed after creation.'}>
          <TextField value={form.key} onChange={(e) => set('key', e.target.value)} disabled={!isNew} placeholder="chest.incline_press" />
        </Field>
        <Field label="Display name">
          <TextField value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Incline Press" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Muscle group">
            <SelectField value={form.muscle_group_raw ?? ''} onChange={(v) => set('muscle_group_raw', v || null)} options={GROUPS.map((g) => ({ value: g, label: g }))} placeholder="—" />
          </Field>
          <Field label="Sort order">
            <NumberField value={form.sort_order} onChange={(e) => set('sort_order', parseInt(e.target.value || '0', 10))} />
          </Field>
        </div>
        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />

        {!isNew && (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700">
              Exercises in this variation ({members.length})
            </p>
            <p className="mb-2 text-xs text-slate-400">Set an exercise’s variation from the Exercises tab.</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm">
              {members.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => (
                    <span key={m.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {m.name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">No exercises yet.</span>
              )}
            </div>
          </div>
        )}
      </div>
      <SaveBar onSave={save} onCancel={() => nav('/exercises')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
