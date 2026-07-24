import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useGoals } from '../../lib/content';
import { Field, TextField, NumberField, Toggle, SaveBar } from '../../components/ui';

export default function GoalEditor() {
  const { key } = useParams();
  const nav = useNavigate();
  const { goals, loading } = useGoals();

  const [displayName, setDisplayName] = useState('');
  const [repShift, setRepShift] = useState(0);
  const [restMult, setRestMult] = useState(1);
  const [setShift, setSetShift] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const g = goals?.find((x) => x.goal_key === key);
    if (g) {
      setDisplayName(g.display_name);
      setRepShift(g.rep_shift);
      setRestMult(g.rest_multiplier);
      setSetShift(g.set_shift);
      setEnabled(g.enabled);
    }
  }, [goals, key]);

  async function save() {
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('content_goal_profiles').update({
      display_name: displayName.trim(),
      rep_shift: repShift,
      rest_multiplier: restMult,
      set_shift: setShift,
      enabled,
    }).eq('goal_key', key);
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
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{displayName || 'Edit goal'}</h1>
      <p className="mb-6 font-mono text-xs text-slate-400">{key}</p>
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
      <SaveBar onSave={save} onCancel={() => nav('/goals')} onDelete={del} saving={saving} error={error} />
    </div>
  );
}
