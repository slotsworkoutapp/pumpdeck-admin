import type { ReactNode } from 'react';

// Shared form primitives — reused by every module's editors.

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500';

export function TextField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function NumberField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" {...props} className={inputCls} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputCls + ' min-h-[72px]'} />;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
      {label}
    </label>
  );
}

// A checklist multi-select (used for secondary muscles). Compact + scrollable.
export function MultiSelect({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string; group?: string }[];
}) {
  const set = new Set(selected);
  const toggle = (v: string) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange([...next]);
  };
  return (
    <div className="max-h-48 overflow-auto rounded-lg border border-slate-300 p-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              set.has(o.value) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SaveBar({
  onSave,
  onCancel,
  onDelete,
  saving,
  error,
}: {
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  error?: string | null;
}) {
  return (
    <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t border-slate-200 bg-white/90 py-3 backdrop-blur">
      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        Cancel
      </button>
      {onDelete && (
        <button onClick={onDelete} className="ml-auto rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
          Delete
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
