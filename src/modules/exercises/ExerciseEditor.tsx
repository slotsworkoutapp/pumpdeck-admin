import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';
import { useCatalog, EQUIPMENT_OPTIONS, type ContentExercise } from '../../lib/content';
import { Field, TextField, NumberField, TextArea, SelectField, MultiSelect, Toggle, SaveBar } from '../../components/ui';
import ExerciseMedia from './ExerciseMedia';
import { GroupMap } from '../../components/GroupMap';

const NAMESPACE = '9e1b7c42-1f3a-4d58-9a2e-6c0b5d8f44a1'; // == SeedID namespace

const TYPES = ['reps', 'cardio', 'timed'];
const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Values stay 'normal' / 'warmup' / 'cooldown' (what the app expects); the
// labels are what the app shows. The fourth is a PAIR — kind warmup, also
// cooldown — because an exercise can be offered as two kinds and this is the
// only combination anyone performs: a hip-flexor stretch belongs before squats
// and after them. "Also a workout" beside a stretch is not a thing.
const KIND_WARMUP_AND_STRETCH = 'warmup+cooldown';
const KIND_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'cooldown', label: 'Stretch' },
  { value: KIND_WARMUP_AND_STRETCH, label: 'Warm-up & Stretch' },
];

const blank: Omit<ContentExercise, 'id'> = {
  name: '',
  type_raw: 'reps',
  kind_raw: 'normal',
  also_kind_raw: null,
  primary_muscle_id: null,
  primary_group_raw: null,
  primary_groups_raw: [],
  collection_id: null,
  trains_tagged_muscle: true,
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

  // Anatomical muscles only. Collections (Mobility, Plyometrics, Conditioning)
  // live in `content_muscles` with group_raw='focus' because they share the
  // tagging machinery — but they are NOT muscles, and offering them here is
  // what produced "primary muscle: Plyometrics" rows in the first place.
  const muscleOptions = useMemo(
    () => (catalog?.muscles ?? []).filter((m) => m.group_raw !== 'focus').map((m) => ({ value: m.id, label: m.name })),
    [catalog]
  );
  /// Which group a muscle belongs to — drives the silhouette on each chip.
  const groupOfMuscle = useMemo(() => {
    const m = new Map((catalog?.muscles ?? []).map((x) => [x.id, x.group_raw]));
    return (id: string) => m.get(id) ?? null;
  }, [catalog]);

  /// Warm-ups and stretches only tag LEG heads — every other group stops at the
  /// group. Offering the rest was the form contradicting its own hint, and it's
  /// how the catalog ended up with a chest stretch filed against Mid Chest.
  const legMuscleOptions = useMemo(
    () => (catalog?.muscles ?? []).filter((m) => m.group_raw === 'legs').map((m) => ({ value: m.id, label: m.name })),
    [catalog]
  );

  const collectionOptions = useMemo(
    () =>
      (catalog?.muscles ?? [])
        .filter((m) => m.group_raw === 'focus')
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({ value: m.id, label: m.name })),
    [catalog]
  );
  /// Variations for the muscle you picked — Upper Chest offers Incline Press
  /// and Incline Fly, not all eight chest families and certainly not all 55.
  ///
  /// Derived from the exercises rather than the family's own group, because
  /// the group is too coarse to be useful: Fly, Press, Decline Press and the
  /// rest are all "chest", but a decline press is not a version of an incline
  /// one. A family is offered when some exercise with THIS primary muscle is
  /// already in it, which is the same thing the app's picker computes — it
  /// lists exercises sharing your primary muscle and joins whichever family you
  /// pick.
  ///
  /// Three deliberate escapes:
  ///   - no primary muscle: nothing to narrow BY, so show everything
  ///   - a muscle with no families yet: fall back to its group, or the dropdown
  ///     would be empty and the first variation for a muscle unassignable
  ///   - the family already stored always stays listed, even out of scope.
  ///     Hiding the current value leaves the dropdown blank over a real answer,
  ///     and saving would then quietly clear it.
  const familyOptions = useMemo(() => {
    const all = (catalog?.families ?? []).map((f) => ({
      value: f.key,
      label: f.display_name,
      group: f.muscle_group_raw,
    }));
    const muscleID = form.primary_muscle_id;
    if (!muscleID) return all;

    const reachable = new Set(
      (catalog?.exercises ?? [])
        .filter((e) => e.primary_muscle_id === muscleID && e.movement_family_key)
        .map((e) => e.movement_family_key as string)
    );
    const scoped = reachable.size
      ? all.filter((f) => reachable.has(f.value))
      : all.filter((f) => f.group === groupOfMuscle(muscleID));

    const current = form.movement_family_key;
    if (current && !scoped.some((f) => f.value === current)) {
      const held = all.find((f) => f.value === current);
      if (held) return [held, ...scoped];
    }
    return scoped;
  }, [catalog, form.primary_muscle_id, form.movement_family_key, groupOfMuscle]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  /// Additional primaries are folded away unless the row already has some —
  /// hiding a field that HOLDS a value would make the form lie about what it's
  /// about to save.
  const [showAdditionalPrimaries, setShowAdditionalPrimaries] = useState(false);
  useEffect(() => {
    if (form.additional_primary_muscle_ids.length > 0) setShowAdditionalPrimaries(true);
  }, [form.additional_primary_muscle_ids.length]);

  /// Warm-ups and stretches file by GROUP and list the muscles they reach —
  /// the app collapsed its two muscle rows into one for exactly these.
  const isStretchy = form.kind_raw === 'warmup' || form.kind_raw === 'cooldown';

  /// The pair reads as one choice in the dropdown but is stored as two columns.
  const kindChoice =
    form.kind_raw === 'warmup' && form.also_kind_raw === 'cooldown'
      ? KIND_WARMUP_AND_STRETCH
      : form.kind_raw;

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
      // A stretch has no primary and no additional primaries, whatever a row
      // saved before this rule may still be carrying.
      also_kind_raw: form.also_kind_raw || null,
      primary_muscle_id: isStretchy ? null : form.primary_muscle_id || null,
      movement_family_key: isStretchy ? null : form.movement_family_key || null,
      additional_primary_muscle_ids: isStretchy ? [] : form.additional_primary_muscle_ids,
      // The array is what the app reads. The old single column is kept in sync
      // with its first element so a client built before the array still files
      // the exercise somewhere sensible rather than nowhere.
      primary_groups_raw: isStretchy ? form.primary_groups_raw : [],
      primary_group_raw: isStretchy ? (form.primary_groups_raw[0] ?? null) : null,
      collection_id: form.collection_id || null,
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
            <SelectField
              value={kindChoice}
              onChange={(v) => {
                if (v === KIND_WARMUP_AND_STRETCH) {
                  setForm((f) => ({ ...f, kind_raw: 'warmup', also_kind_raw: 'cooldown' }));
                } else {
                  // Any single kind clears the second one, or switching away
                  // from the pair would leave a stray "also" behind.
                  setForm((f) => ({ ...f, kind_raw: v, also_kind_raw: null }));
                }
              }}
              options={KIND_OPTIONS}
            />
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

        {/* Not asked for warm-ups and stretches: they file by GROUP, and the
            app's own picker refuses to offer a head for one. Leaving the field
            visible invited an answer the client would then discard, and every
            row in the catalog already has it null. */}
        {!isStretchy && (
        <Field
          label="Primary muscle"
          hint={
            form.type_raw === 'cardio'
              ? 'Cardio is usually muscle-agnostic — leave blank.'
              : 'Anatomical muscles only. A Burpee has no honest primary muscle — leave it blank and give it a collection.'
          }
        >
          {/* A native <select> can't put art in its options, so the map sits
              beside it and follows the choice. */}
          <div className="flex items-center gap-2">
            <GroupMap
              group={form.primary_muscle_id ? groupOfMuscle(form.primary_muscle_id) : null}
              className="size-8 shrink-0 object-contain"
            />
            <SelectField
              value={form.primary_muscle_id ?? ''}
              onChange={(v) => {
                set('primary_muscle_id', v || null);
                // A group is a coarser answer to the same question — the app
                // treats them as mutually exclusive, so the dashboard must too.
                if (v) set('primary_groups_raw', []);
              }}
              options={muscleOptions}
              placeholder="— none —"
            />
          </div>
        </Field>
        )}

        {/* Warm-ups and stretches only. Nobody asks for a side-delt stretch —
            they want a shoulder stretch, and the group is the honest filing. */}
        {isStretchy && (
          <Field
            label="Muscle groups"
            hint="Where this is filed, and the only muscle question these are asked. Naming one head would be false precision — nobody asks for a lower-chest warm-up. Pick every group it genuinely reaches: a doorway chest stretch is chest AND shoulders."
          >
            <MultiSelect
              selected={form.primary_groups_raw}
              onChange={(v) => {
                set('primary_groups_raw', v);
                if (v.length) set('primary_muscle_id', null);
              }}
              options={MUSCLE_GROUPS.map((g) => ({ value: g, label: cap(g) }))}
              mapGroup={(g) => g}
            />
          </Field>
        )}

        {/* Paired: both answer "what else is this filed as", both are a single
            dropdown, and both are usually empty. Side by side they read as one
            optional row instead of two more things to scroll past. */}
        <div className={isStretchy ? '' : 'grid grid-cols-2 gap-4'}>
          <Field
            label="Collection"
            hint="Where it's filed when a muscle isn't the point — Mobility, Plyometrics, Conditioning. Independent of the muscle: an exercise can have both, either, or neither."
          >
            <SelectField
              value={form.collection_id ?? ''}
              onChange={(v) => set('collection_id', v || null)}
              options={collectionOptions}
              placeholder="— none —"
            />
          </Field>

          {/* Hidden for warm-ups and stretches, matching the app: a variation is
              a version of ONE movement, which is a workout-set idea. A stretch is
              filed at group grain and slotted at group grain, so a third grain in
              between is a question with nowhere to land. */}
          {!isStretchy && (
            <Field
              label="Variation (movement family)"
              hint={
                form.primary_muscle_id
                  ? 'Exercises sharing a family are interchangeable in a program. Narrowed to the families this muscle already has exercises in.'
                  : 'Exercises sharing a family are interchangeable in a program. Pick a primary muscle to narrow this list.'
              }
            >
              <SelectField value={form.movement_family_key ?? ''} onChange={(v) => set('movement_family_key', v || null)} options={familyOptions} placeholder="— none —" />
            </Field>
          )}
        </div>

        {(form.primary_muscle_id || form.secondary_muscle_ids.length > 0) && (
          <Toggle
            checked={form.trains_tagged_muscle}
            onChange={(v) => set('trains_tagged_muscle', v)}
            label="Trains its muscles (counts toward volume + fills muscle slots)"
          />
        )}

        <Field
          label={isStretchy ? 'Muscles it reaches' : 'Secondary muscles'}
          hint={
            isStretchy
              ? "Legs only, and optional. A quad stretch and a calf stretch really are different things people ask for, so leg heads fill per-muscle stretch slots. Every other group stops at the group above — tag Shoulders there, not Rear Delt."
              : undefined
          }
        >
          <MultiSelect
            selected={form.secondary_muscle_ids}
            onChange={(v) => set('secondary_muscle_ids', v)}
            options={isStretchy ? legMuscleOptions : muscleOptions}
            mapGroup={groupOfMuscle}
          />
        </Field>

        {/* A second "home" muscle is a primary-vs-secondary idea, and warm-ups
            and stretches don't have one — the field above already asks the only
            question they answer.

            Folded away for everything else because it's a genuine rarity: a
            handful of dual-movers across the whole catalog. A full-height muscle
            grid sitting open for a field almost nobody fills pushes the fields
            people DO fill off the screen. */}
        {!isStretchy && (
          <div className="rounded-lg border border-slate-200 p-3">
            <Toggle
              checked={showAdditionalPrimaries}
              onChange={setShowAdditionalPrimaries}
              label="This is a dual-mover (has a second home muscle)"
            />
            {showAdditionalPrimaries && (
              <div className="mt-3">
                <Field label="Additional primary muscles" hint="Extra 'home' muscles for dual-movers (e.g. Hammer Curl → Biceps). Usually empty.">
                  <MultiSelect
                    selected={form.additional_primary_muscle_ids}
                    onChange={(v) => set('additional_primary_muscle_ids', v)}
                    options={muscleOptions}
                    mapGroup={groupOfMuscle}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

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
