import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';
import { useCatalog, type ContentMuscle } from '../../lib/content';
import { Field, TextField, NumberField, TextArea, SelectField, Toggle, SaveBar } from '../../components/ui';
import { COLLECTION_COLORS, COLLECTION_ICONS, DEFAULT_COLLECTION_ICON } from '../../lib/collectionStyle';

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
  groups_by: null,
  exercises_train_muscle: null,
  enabled: true,
};

export default function MuscleEditor() {
  const { id } = useParams();
  // The "new" route has no `:id` param, so `id` is undefined there — treat a
  // missing id as new too, else "create" silently hits the update path.
  const isNew = !id || id === 'new';
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
            <SelectField
              value={form.group_raw}
              onChange={(v) => set('group_raw', v)}
              options={GROUPS.map((g) => ({ value: g, label: g === 'focus' ? 'collection (not a muscle)' : g }))}
            />
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
          <>
            <Field label="Colour" hint="The sixteen the app's own picker offers. Default paints in the accent colour.">
              <div className="flex flex-wrap gap-2">
                <Swatch
                  color={null}
                  selected={!form.color_hex}
                  onClick={() => set('color_hex', null)}
                />
                {COLLECTION_COLORS.map((hex) => (
                  <Swatch
                    key={hex}
                    color={hex}
                    selected={(form.color_hex ?? '').toLowerCase() === hex.toLowerCase()}
                    onClick={() => set('color_hex', hex)}
                  />
                ))}
              </div>
            </Field>

            <Field
              label="Icon"
              hint="SF Symbols can't render here, so each shows an emoji stand-in — the app draws the real symbol."
            >
              <SelectField
                value={form.icon_name ?? ''}
                onChange={(v) => set('icon_name', v || null)}
                options={COLLECTION_ICONS.map((i) => ({ value: i.value, label: `${i.emoji}  ${i.label}` }))}
                placeholder={`— default (${COLLECTION_ICONS.find((i) => i.value === DEFAULT_COLLECTION_ICON)?.label ?? 'Star'}) —`}
              />
            </Field>

            <Field
              label="Group exercises by"
              hint="How this collection's page splits its exercises. Muscle suits stretches (a hip opener isn't a version of a shoulder dislocate); variation suits movements that come in versions."
            >
              <SelectField
                value={form.groups_by ?? ''}
                onChange={(v) => set('groups_by', v || null)}
                options={[
                  { value: 'variation', label: 'Variation — by movement or purpose' },
                  { value: 'muscle', label: 'Muscle — by the muscle they target' },
                ]}
                placeholder="— default (variation) —"
              />
            </Field>

            <Toggle
              checked={form.exercises_train_muscle ?? true}
              onChange={(v) => set('exercises_train_muscle', v)}
              label="Count toward muscle training (default for exercises filed here)"
            />
            <p className="-mt-2 text-xs text-slate-500">
              On: an exercise here counts toward its muscle's weekly volume and can fill its slots. Off: the muscle
              only organizes it — a chest stretch involves the chest without building it. Users can change any single
              exercise afterwards.
            </p>
          </>
        )}

        <Toggle checked={form.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />
      </div>
      <SaveBar onSave={save} onCancel={() => nav('/exercises')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}

/// One colour choice. `color: null` is the "no override" swatch — the app
/// paints those collections in its accent colour.
function Swatch({ color, selected, onClick }: { color: string | null; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={color ?? 'Default (accent)'}
      style={color ? { backgroundColor: color } : undefined}
      className={`grid size-8 place-items-center rounded-full border-2 text-[10px] font-bold ${
        color ? 'text-white' : 'bg-white text-slate-400'
      } ${selected ? 'border-slate-900' : 'border-transparent'}`}
    >
      {color ? (selected ? '✓' : '') : 'A'}
    </button>
  );
}
