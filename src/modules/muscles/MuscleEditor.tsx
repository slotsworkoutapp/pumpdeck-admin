import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';
import { useCatalog, type ContentMuscle } from '../../lib/content';
import { Field, TextField, NumberField, TextArea, SelectField, Toggle, SaveBar } from '../../components/ui';

const NAMESPACE = '9e1b7c42-1f3a-4d58-9a2e-6c0b5d8f44a1';
const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms', 'focus'];

const blank: Omit<ContentMuscle, 'id'> = {
  name: '',
  group_raw: 'chest',
  sort_order: 999,
  body_map_id: null,
  description: null,
  color_hex: null,
  icon_name: null,
  enabled: true,
};

export default function MuscleEditor() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const { catalog, loading } = useCatalog();

  const [form, setForm] = useState<Omit<ContentMuscle, 'id'>>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !catalog) return;
    const m = catalog.muscles.find((x) => x.id === id);
    if (m) {
      const { id: _omit, ...rest } = m;
      setForm(rest);
    }
  }, [catalog, id, isNew]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isFocus = form.group_raw === 'focus';

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true);
    const rowId = isNew ? uuidv5(form.name.trim(), NAMESPACE) : (id as string);
    const { error } = await supabase.from('content_muscles').upsert({
      id: rowId,
      ...form,
      name: form.name.trim(),
      body_map_id: form.body_map_id || null,
      description: form.description || null,
      color_hex: form.color_hex || null,
      icon_name: form.icon_name || null,
    });
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  async function del() {
    if (!confirm(`Delete "${form.name}"? Exercises referencing it may break.`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_muscles').delete().eq('id', id);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{isNew ? 'New muscle' : form.name || 'Edit muscle'}</h1>
      <div className="space-y-4">
        <Field label="Name">
          <TextField value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Upper Chest" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Group">
            <SelectField value={form.group_raw} onChange={(v) => set('group_raw', v)} options={GROUPS.map((g) => ({ value: g, label: g }))} />
          </Field>
          <Field label="Sort order">
            <NumberField value={form.sort_order} onChange={(e) => set('sort_order', parseInt(e.target.value || '0', 10))} />
          </Field>
        </div>
        <Field label="Body map ID" hint="Key into the silhouette highlight (e.g. upper-chest). Leave blank for focuses.">
          <TextField value={form.body_map_id ?? ''} onChange={(e) => set('body_map_id', e.target.value)} />
        </Field>
        <Field label="Description">
          <TextArea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </Field>
        {isFocus && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Color (hex)" hint="Focuses only.">
              <TextField value={form.color_hex ?? ''} onChange={(e) => set('color_hex', e.target.value)} placeholder="#3B82F6" />
            </Field>
            <Field label="Icon (SF Symbol)" hint="Focuses only.">
              <TextField value={form.icon_name ?? ''} onChange={(e) => set('icon_name', e.target.value)} placeholder="star.fill" />
            </Field>
          </div>
        )}

        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />
      </div>
      <SaveBar onSave={save} onCancel={() => nav('/exercises')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
