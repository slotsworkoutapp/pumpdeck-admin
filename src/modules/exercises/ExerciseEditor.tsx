import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';
import { useCatalog, EQUIPMENT_OPTIONS, type ContentExercise } from '../../lib/content';
import { Field, TextField, NumberField, TextArea, SelectField, MultiSelect, Toggle, SaveBar } from '../../components/ui';
import ExerciseMedia from './ExerciseMedia';

const NAMESPACE = '9e1b7c42-1f3a-4d58-9a2e-6c0b5d8f44a1'; // == SeedID namespace

const TYPES = ['reps', 'cardio', 'timed'];
// value stays 'cooldown' (what the app expects) but shows as "Stretch".
const KIND_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Stretch' },
];

const blank: Omit<ContentExercise, 'id'> = {
  name: '',
  type_raw: 'reps',
  kind_raw: 'normal',
  primary_muscle_id: null,
  secondary_muscle_ids: [],
  additional_primary_muscle_ids: [],
  default_rest_seconds: 90,
  movement_family_key: null,
  equipment: null,
  description: null,
  notes: null,
  sort_order: 999,
  enabled: true,
};

export default function ExerciseEditor() {
  const { id } = useParams();
  // The "new" route (path: 'new') has no `:id` param, so `id` is undefined there
  // — treat a missing id as new too, else the insert sends a null primary key.
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const { catalog, loading } = useCatalog();

  const [form, setForm] = useState<Omit<ContentExercise, 'id'>>(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate when editing an existing exercise.
  useEffect(() => {
    if (isNew || !catalog) return;
    const ex = catalog.exercises.find((e) => e.id === id);
    if (ex) {
      const { id: _omit, ...rest } = ex;
      setForm(rest);
    }
  }, [catalog, id, isNew]);

  const muscleOptions = useMemo(
    () => (catalog?.muscles ?? []).map((m) => ({ value: m.id, label: m.name })),
    [catalog]
  );
  const familyOptions = useMemo(
    () => (catalog?.families ?? []).map((f) => ({ value: f.key, label: f.display_name })),
    [catalog]
  );

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError('Name is required.');
    // Required for NEW exercises only, so no untagged row enters the catalog.
    // Existing ones stay editable while the tagging pass fills them in.
    if (isNew && !form.equipment) return setError('Please select the equipment.');
    setSaving(true);
    const rowId = isNew ? uuidv5(form.name.trim(), NAMESPACE) : (id as string);
    const { error } = await supabase.from('content_exercises').upsert({
      id: rowId,
      ...form,
      name: form.name.trim(),
      primary_muscle_id: form.primary_muscle_id || null,
      movement_family_key: form.movement_family_key || null,
      equipment: form.equipment || null,
      description: form.description || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  async function del() {
    if (!confirm(`Delete "${form.name}"? (Users who already have it keep their copy.)`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_exercises').delete().eq('id', id);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/exercises');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{isNew ? 'New exercise' : form.name || 'Edit exercise'}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Changes reach users on their next sync — no app release.
      </p>

      <div className="space-y-4">
        <Field label="Name">
          <TextField value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Incline Cable Fly" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <SelectField value={form.type_raw} onChange={(v) => set('type_raw', v)} options={TYPES.map((t) => ({ value: t, label: t }))} />
          </Field>
          <Field label="Kind">
            <SelectField value={form.kind_raw} onChange={(v) => set('kind_raw', v)} options={KIND_OPTIONS} />
          </Field>
        </div>

        <Field
          label="Equipment"
          hint="What the exercise needs. Users declare what they own, and we hide the rest + filter their Discover feed. Untagged shows for everyone."
        >
          <SelectField
            value={form.equipment ?? ''}
            onChange={(v) => set('equipment', v || null)}
            options={EQUIPMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            placeholder="— not tagged —"
          />
        </Field>

        <Field label="Primary muscle" hint={form.type_raw === 'cardio' ? 'Cardio is usually muscle-agnostic — leave blank.' : undefined}>
          <SelectField value={form.primary_muscle_id ?? ''} onChange={(v) => set('primary_muscle_id', v || null)} options={muscleOptions} placeholder="— none —" />
        </Field>

        <Field label="Secondary muscles">
          <MultiSelect selected={form.secondary_muscle_ids} onChange={(v) => set('secondary_muscle_ids', v)} options={muscleOptions} />
        </Field>

        <Field label="Additional primary muscles" hint="Extra 'home' muscles for dual-movers (e.g. Hammer Curl → Biceps). Usually empty.">
          <MultiSelect selected={form.additional_primary_muscle_ids} onChange={(v) => set('additional_primary_muscle_ids', v)} options={muscleOptions} />
        </Field>

        <Field label="Variation (movement family)" hint="Exercises sharing a family are interchangeable in a program.">
          <SelectField value={form.movement_family_key ?? ''} onChange={(v) => set('movement_family_key', v || null)} options={familyOptions} placeholder="— none —" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Default rest (seconds)">
            <NumberField value={form.default_rest_seconds} onChange={(e) => set('default_rest_seconds', parseInt(e.target.value || '0', 10))} />
          </Field>
          <Field label="Sort order">
            <NumberField value={form.sort_order} onChange={(e) => set('sort_order', parseInt(e.target.value || '0', 10))} />
          </Field>
        </div>

        <Field label="Notes / form cues">
          <TextArea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Enabled (delivered to the app)" />

        {isNew ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400">
            Save the exercise first, then reopen it to add a demo video and thumbnail.
          </div>
        ) : (
          <ExerciseMedia exerciseId={id as string} />
        )}
      </div>

      <SaveBar onSave={save} onCancel={() => nav('/exercises')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
