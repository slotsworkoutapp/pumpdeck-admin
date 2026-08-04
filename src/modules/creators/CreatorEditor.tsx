import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCreators } from '../../lib/content';
import { Field, TextField, NumberField, TextArea, Toggle, SaveBar } from '../../components/ui';

// Codes are compared uppercased with no spaces (matches the app's onboarding
// normalization), so normalize on the way in too.
const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export default function CreatorEditor() {
  const { id } = useParams();
  // The "new" route has no `:id` param, so `id` is undefined there — treat a
  // missing id as new too, else "create" silently hits the update path.
  const isNew = !id || id === 'new';
  const nav = useNavigate();
  const { creators, loading } = useCreators();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [ratePct, setRatePct] = useState(30); // shown as a percent; stored as 0..1
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !creators) return;
    const c = creators.find((x) => x.id === id);
    if (c) {
      setName(c.name);
      setCode(c.code);
      setEmail(c.email ?? '');
      setRatePct(Math.round(c.payout_rate * 100));
      setActive(c.active);
      setNotes(c.notes ?? '');
    }
  }, [creators, id, isNew]);

  async function save() {
    setError(null);
    const cleanCode = normalizeCode(code);
    if (!name.trim()) return setError('Name is required.');
    if (!cleanCode) return setError('Code is required (letters and numbers only).');
    if (ratePct < 0 || ratePct > 100) return setError('Payout rate must be between 0 and 100%.');

    const fields = {
      name: name.trim(),
      code: cleanCode,
      email: email.trim() || null,
      payout_rate: ratePct / 100,
      active,
      notes: notes.trim() || null,
    };

    setSaving(true);
    let error;
    if (isNew) {
      ({ error } = await supabase.from('creators').insert(fields));
    } else {
      ({ error } = await supabase.from('creators').update(fields).eq('id', id));
    }
    setSaving(false);
    if (error) {
      // Surface the case-insensitive unique-code violation in plain language.
      setError(/creators_code_unique|duplicate key/i.test(error.message) ? `Code "${cleanCode}" is already taken by another creator.` : error.message);
    } else {
      nav('/creators');
    }
  }

  async function del() {
    if (!confirm(`Delete creator "${name}"? Their code will no longer be credited. Existing referral_source values on users are unaffected.`)) return;
    setSaving(true);
    const { error } = await supabase.from('creators').delete().eq('id', id);
    setSaving(false);
    if (error) setError(error.message);
    else nav('/creators');
  }

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">{isNew ? 'New creator' : name || 'Edit creator'}</h1>
      <div className="space-y-4">
        <Field label="Name">
          <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Trainer" />
        </Field>
        <Field label="Referral code" hint="What users type in onboarding. Letters/numbers only; auto-uppercased.">
          <TextField
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ALEX"
            className="font-mono"
          />
        </Field>
        <Field label="Email" hint="For payouts / contact (optional).">
          <TextField type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" />
        </Field>
        <Field label="Payout rate (%)" hint="Share of net revenue this creator earns per referred subscriber. Some creators can get a higher rate.">
          <NumberField value={ratePct} min={0} max={100} onChange={(e) => setRatePct(parseInt(e.target.value || '0', 10))} />
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Deal terms, channel, anything worth remembering." />
        </Field>
        <Toggle checked={active} onChange={setActive} label="Active" />
      </div>
      <SaveBar onSave={save} onCancel={() => nav('/creators')} onDelete={isNew ? undefined : del} saving={saving} error={error} />
    </div>
  );
}
