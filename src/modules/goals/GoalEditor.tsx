import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../../lib/supabase';
import { useGoals } from '../../lib/content';
import { Field, TextField, NumberField, Toggle, SaveBar } from '../../components/ui';

const NAMESPACE = '7a2c9f10-3e5b-4c8d-9f1a-2b6d4e8c0a33';

export default function GoalEditor() {
  const { key } = useParams();
  // The "new" route has no `:key` param, so `key` is undefined there — treat a
  // missing key as new too, else "create" silently hits the update path.
  const isNew = !key || key === 'new';
  const nav = useNavigate();
  const { goals, loading } = useGoals();

  const [newKey, setNewKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [repShift, setRepShift] = useState(0);
  const [restMult, setRestMult] = useState(1);
  const [setShift, setSetShift] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    const g = goals?.find((x) => x.goal_key === key);
    if (g) {
      setDisplayName(g.display_name);
      setRepShift(g.rep_shift);
      setRestMult(g.rest_multiplier);
      setSetShift(g.set_shift);
      setEnabled(g.enabled);
    }
  }, [goals, key, isNew]);

  async function save() {
    setError(null);
    if (!displayName.trim()) return setError('Display name is required.');
    setSaving(true);
    const fields = { display_name: displayName.trim(), rep_shift: repShift, rest_multiplier: restMult, set_shift: setShift, enabled };
    let error;
    if (isNew) {
      const k = newKey.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) {
        setSaving(false);
        return setError('Key must start with a letter; letters, numbers, and underscores only (e.g. powerlifting).');
      }
      if ((goals ?? []).some((g) => g.goal_key === k)) {
        setSaving(false);
        return setError(`Key "${k}" already exists.`);
      }
      const maxSort = Math.max(0, ...(goals ?? []).map((g) => g.sort_order));
      ({ error } = await supabase.from('content_goal_profiles').insert({ id: uuidv5(k, NAMESPACE), goal_key: k, sort_order: maxSort + 1, ...fields }));
    } else {
      ({ error } = await supabase.from('content_goal_profiles').update(fields).eq('goal_key', key));
    }
    setSaving(false);
    if (error) setError(error.message);
    else nav('/goals');
  }

  async function del() {
    if (!confirm(`Delete the "${displayName}" goal?`)) return;
    setSaving(true);
    const { error } = await supabase.from('content_goal_profiles').delete().eq('goal_key', key);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/goals');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{isNew ? 'New goal' : displayName || 'Edit goal'}</h1>
      {isNew ? (
        <div className="mb-6 mt-2">
          <Field label="Key" hint="Stable id used in code / onboarding (e.g. powerlifting). Can't be changed later.">
            <TextField value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="powerlifting" />
          </Field>
        </div>
      ) : (
        <p className="mb-6 font-mono text-xs text-slate-400">{key}</p>
      )}
      <div className="space-y-4">
        <Field label="Display name">
          <TextField value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Rep shift" hint="Added to every slot's rep range. Strength negative (fewer reps), endurance positive.">
          <NumberField value={repShift} onChange={(e) => setRepShift(parseInt(e.target.value || '0', 10))} />
        </Field>
        <Field label="Rest multiplier" hint="Multiplies each slot's rest. Strength > 1 (longer), endurance < 1.">
          <TextField type="number" step="0.1" value={String(restMult)} onChange={(e) => setRestMult(parseFloat(e.target.value || '1'))} />
        </Field>
        <Field label="Set shift" hint="Added to every slot's set count.">
          <NumberField value={setShift} onChange={(e) => setSetShift(parseInt(e.target.value || '0', 10))} />
        </Field>
        <Toggle checked={enabled} onChange={setEnabled} label="Enabled" />
      </div>
      <SaveBar onSave={save} onCancel={() => nav('/goals')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
