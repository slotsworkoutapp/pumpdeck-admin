import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useSplits, useRecipes, useGoals, useCatalog, type Catalog, type ContentGoal, type ContentSplit } from '../../lib/content';
import { generateProgram, weekdayLabel, type GenDay, type GenSlot } from '../../lib/generate';
import { GROUP_ORDER } from '../../lib/bodymap';

const HAS_MAP = new Set<string>(GROUP_ORDER);
// The three session lengths the app actually offers — the whole scenario grid.
const TIMES = [30, 45, 60];

// Persisted LOCKS: marking a scenario reviewed freezes its exact generated
// program here, so later edits to a shared recipe can't silently change it.
// Keyed split|min|goal → the frozen GenDay[]. (Browser-local for now.)
const LOCK_KEY = 'pd_locked_v1';
function loadLocked(): Record<string, GenDay[]> {
  try { return JSON.parse(localStorage.getItem(LOCK_KEY) ?? '{}'); } catch { return {}; }
}
const scenarioId = (splitKey: string, minutes: number, goalKey: string) => `${splitKey}|${minutes}|${goalKey}`;

export default function Preview() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr, reload: reloadRecipes } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();

  const [locked, setLocked] = useState<Record<string, GenDay[]>>(loadLocked);
  const [active, setActive] = useState<{ splitKey: string; minutes: number; goalKey: string } | null>(null);
  const [editing, setEditing] = useState<GenSlot | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);

  useEffect(() => { localStorage.setItem(LOCK_KEY, JSON.stringify(locked)); }, [locked]);

  // Seed the active scenario once data lands.
  useEffect(() => {
    if (!active && splits?.length && goals?.length) {
      setActive({ splitKey: splits[0].key, minutes: 60, goalKey: goals[0].goal_key });
    }
  }, [active, splits, goals]);

  const recipeIdByType = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes ?? []) m.set(r.day_type, r.id);
    return m;
  }, [recipes]);

  const orderedSplits = useMemo(() => [...(splits ?? [])].sort((a, b) => a.sort_order - b.sort_order), [splits]);
  const total = orderedSplits.length * TIMES.length * (goals?.length ?? 0);
  const doneCount = Object.keys(locked).length;

  // Generate any scenario on demand (pure over the loaded content).
  function genFor(splitKey: string, minutes: number, goalKey: string): GenDay[] {
    const s = orderedSplits.find((x) => x.key === splitKey);
    const g = goals?.find((x) => x.goal_key === goalKey);
    if (!s || !g || !recipes || !catalog) return [];
    return generateProgram(s, recipes, g, minutes, catalog);
  }

  function toggleLock(splitKey: string, minutes: number, goalKey: string) {
    const id = scenarioId(splitKey, minutes, goalKey);
    setLocked((L) => {
      const next = { ...L };
      if (next[id]) delete next[id];
      else next[id] = genFor(splitKey, minutes, goalKey);
      return next;
    });
  }
  function relock(id: string, splitKey: string, minutes: number, goalKey: string) {
    setLocked((L) => ({ ...L, [id]: genFor(splitKey, minutes, goalKey) }));
  }

  const loading = ls || lr || lg || lc;
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!splits || !recipes || !goals || !catalog) return null;

  const split = active ? orderedSplits.find((s) => s.key === active.splitKey) : undefined;
  const goal = active ? goals.find((g) => g.goal_key === active.goalKey) : undefined;
  const activeId = active ? scenarioId(active.splitKey, active.minutes, active.goalKey) : '';
  const isLocked = !!locked[activeId];
  // Live generation (what the recipes produce right now).
  const liveProgram = split && goal && active ? generateProgram(split, recipes, goal, active.minutes, catalog) : [];
  // A locked scenario shows its FROZEN snapshot, immune to later recipe edits.
  const program = isLocked ? locked[activeId] : liveProgram;
  const drift = isLocked && JSON.stringify(locked[activeId]) !== JSON.stringify(liveProgram);

  // Swap the exercise for a slot right from the preview. Editing a locked
  // scenario would break the freeze, so we confirm-unlock first.
  async function applySlotEdit(patch: { slot_kind: 'variation' | 'muscle'; family_key: string | null; muscle_id: string | null }) {
    if (!editing?.slotId) return;
    setSavingSlot(true);
    const { error } = await supabase.from('content_day_recipe_slots').update(patch).eq('id', editing.slotId);
    setSavingSlot(false);
    if (error) { alert(`Couldn't save: ${error.message}`); return; }
    setEditing(null);
    reloadRecipes();
  }
  function handleEditSlot(s: GenSlot) {
    if (isLocked) {
      if (!confirm('This scenario is reviewed & locked. Unlock it to edit? (Editing changes the shared recipe.)')) return;
      setLocked((L) => { const n = { ...L }; delete n[activeId]; return n; });
    }
    setEditing(s);
  }

  return (
    <div className="flex h-full">
      {/* ---- Scenario checklist ---- */}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-slate-900">Scenarios</h2>
            <span className="text-xs font-semibold tabular-nums text-slate-500">{doneCount} / {total} locked</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }} />
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {orderedSplits.map((s) => (
            <SplitGroup
              key={s.key}
              split={s}
              goals={goals}
              locked={locked}
              activeId={activeId}
              onSelect={(minutes, goalKey) => setActive({ splitKey: s.key, minutes, goalKey })}
              onToggle={(minutes, goalKey) => toggleLock(s.key, minutes, goalKey)}
            />
          ))}
        </div>
      </aside>

      {/* ---- Preview of the active scenario ---- */}
      <main className="flex-1 overflow-y-auto p-6">
        {!active || !split || !goal ? (
          <div className="text-slate-400">Pick a scenario on the left.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                  {split.display_name}
                  {isLocked && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">🔒 Locked</span>}
                </h1>
                <p className="text-sm text-slate-500">{goal.display_name} · {active.minutes} min — exactly what a new user gets.</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-slate-300">
                  {TIMES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setActive({ ...active, minutes: m })}
                      className={`px-3 py-1.5 text-sm font-semibold ${active.minutes === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >{m}m</button>
                  ))}
                </div>
                <div className="flex overflow-hidden rounded-lg border border-slate-300">
                  {goals.map((g) => (
                    <button
                      key={g.goal_key}
                      onClick={() => setActive({ ...active, goalKey: g.goal_key })}
                      className={`px-3 py-1.5 text-sm font-semibold ${active.goalKey === g.goal_key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >{g.display_name}</button>
                  ))}
                </div>
                <button
                  onClick={() => toggleLock(active.splitKey, active.minutes, active.goalKey)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold ${isLocked ? 'bg-emerald-500 text-white' : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                >{isLocked ? '✓ Reviewed' : 'Mark reviewed'}</button>
              </div>
            </div>

            {drift && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <span>A recipe changed since you locked this — the frozen version below is what's kept.</span>
                <button
                  onClick={() => relock(activeId, active.splitKey, active.minutes, active.goalKey)}
                  className="ml-3 rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700"
                >Update to current</button>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {program.map((d, i) => (
                <DayCard key={i} day={d} recipeId={d.dayType ? recipeIdByType.get(d.dayType) : undefined} onEditSlot={handleEditSlot} />
              ))}
            </div>
          </>
        )}
      </main>

      {editing && catalog && (
        <SlotPicker slot={editing} catalog={catalog} saving={savingSlot} onClose={() => setEditing(null)} onPick={applySlotEdit} />
      )}
    </div>
  );
}

function SplitGroup({
  split, goals, locked, activeId, onSelect, onToggle,
}: {
  split: ContentSplit;
  goals: ContentGoal[];
  locked: Record<string, GenDay[]>;
  activeId: string;
  onSelect: (minutes: number, goalKey: string) => void;
  onToggle: (minutes: number, goalKey: string) => void;
}) {
  const cells = TIMES.flatMap((m) => goals.map((g) => ({ minutes: m, goal: g, id: scenarioId(split.key, m, g.goal_key) })));
  const done = cells.filter((c) => locked[c.id]).length;
  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-xs font-bold text-slate-700">{split.display_name}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${done === cells.length ? 'text-emerald-600' : 'text-slate-400'}`}>{done}/{cells.length}</span>
      </div>
      <div className="space-y-1">
        {cells.map((c) => {
          const isActive = c.id === activeId;
          const isDone = !!locked[c.id];
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.minutes, c.goal.goal_key)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs ${isActive ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-100'}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(c.minutes, c.goal.goal_key); }}
                className={`grid size-4 shrink-0 place-items-center rounded border ${isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}
                title={isDone ? 'Locked — click to unlock' : 'Mark reviewed & lock'}
              >{isDone && <span className="text-[9px] leading-none">✓</span>}</button>
              <span className={`flex-1 ${isDone ? 'text-slate-400' : 'text-slate-700'}`}>{c.minutes}m · {c.goal.display_name}</span>
              {isDone && <span className="text-[9px]">🔒</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotPicker({
  slot, catalog, saving, onClose, onPick,
}: {
  slot: GenSlot;
  catalog: Catalog;
  saving: boolean;
  onClose: () => void;
  onPick: (patch: { slot_kind: 'variation' | 'muscle'; family_key: string | null; muscle_id: string | null }) => void;
}) {
  const [tab, setTab] = useState<'variation' | 'muscle'>(slot.kind === 'muscle' ? 'muscle' : 'variation');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();

  const families = useMemo(
    () =>
      [...catalog.families]
        .sort((a, b) => (a.muscle_group_raw ?? '').localeCompare(b.muscle_group_raw ?? '') || a.display_name.localeCompare(b.display_name))
        .filter((f) => !ql || f.display_name.toLowerCase().includes(ql) || (f.muscle_group_raw ?? '').toLowerCase().includes(ql)),
    [catalog, ql]
  );
  const muscles = useMemo(
    () =>
      [...catalog.muscles]
        .sort((a, b) => a.group_raw.localeCompare(b.group_raw) || a.name.localeCompare(b.name))
        .filter((m) => !ql || m.name.toLowerCase().includes(ql) || m.group_raw.toLowerCase().includes(ql)),
    [catalog, ql]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Swap exercise</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Currently <span className="font-semibold text-slate-700">{slot.label}</span> — changes this slot in the recipe (everywhere it's used).
          </p>
          <div className="mt-3 flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            {(['variation', 'muscle'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 font-semibold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >{t === 'variation' ? 'Variations' : 'Whole muscle'}</button>
            ))}
          </div>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {saving ? (
            <div className="p-4 text-center text-sm text-slate-400">Saving…</div>
          ) : tab === 'variation' ? (
            families.map((f) => (
              <button
                key={f.key}
                onClick={() => onPick({ slot_kind: 'variation', family_key: f.key, muscle_id: null })}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50 ${slot.familyKey === f.key ? 'bg-indigo-50' : ''}`}
              >
                <span className="w-16 shrink-0 text-[10px] font-bold uppercase text-slate-400">{f.muscle_group_raw ?? '?'}</span>
                <span className="font-semibold text-slate-800">{f.display_name}</span>
              </button>
            ))
          ) : (
            muscles.map((m) => (
              <button
                key={m.id}
                onClick={() => onPick({ slot_kind: 'muscle', family_key: null, muscle_id: m.id })}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-indigo-50"
              >
                <span className="w-16 shrink-0 text-[10px] font-bold uppercase text-slate-400">{m.group_raw}</span>
                <span className="font-semibold text-slate-800">{m.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, recipeId, onEditSlot }: { day: GenDay; recipeId?: string; onEditSlot: (s: GenSlot) => void }) {
  const totalSets = day.slots.reduce((n, s) => n + s.sets, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-bold text-slate-900">
          <span className="text-slate-400">{weekdayLabel(day.weekday)}</span> {day.dayName}
        </span>
        <div className="flex items-baseline gap-2">
          {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{day.slots.length} ex · {totalSets} sets · ~{day.estMinutes}m</span>}
          {recipeId && <Link to={`/recipes/${recipeId}`} className="text-xs font-semibold text-indigo-500 hover:underline">edit</Link>}
        </div>
      </div>
      {day.note ? (
        <div className="px-4 py-3 text-sm text-amber-600">{day.note}</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {day.slots.map((s, i) => (
            <li
              key={i}
              onClick={() => s.slotId && onEditSlot(s)}
              className={`flex items-center gap-2 px-4 py-2 text-sm ${s.slotId ? 'cursor-pointer hover:bg-indigo-50' : ''}`}
              title={s.slotId ? 'Click to swap this exercise' : undefined}
            >
              {s.group && HAS_MAP.has(s.group) ? (
                <img src={`/maps/${s.group}.svg`} alt="" className="size-8 shrink-0 object-contain" />
              ) : (
                <span className="size-8 shrink-0" />
              )}
              <span className="flex-1 font-semibold text-slate-800">{s.label}</span>
              {s.kind === 'muscle' && <span className="text-[10px] font-bold uppercase text-indigo-500">muscle</span>}
              <span className="tabular-nums text-slate-500">{s.sets} × {s.reps}</span>
              <span className="w-12 text-right tabular-nums text-xs text-slate-400">{s.rest}s</span>
            </li>
          ))}
          {day.dropped > 0 && (
            <li className="px-4 py-1.5 text-xs text-slate-400">+{day.dropped} more trimmed to fit the time</li>
          )}
        </ul>
      )}
    </div>
  );
}
