import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSplits, useRecipes, useGoals, useCatalog, useLockedPrograms,
  lockProgram, unlockProgram, lockId,
  type Catalog, type ContentGoal, type ContentSplit, type LockedDay,
} from '../../lib/content';
import { generateProgram, weekdayLabel, type GenDay } from '../../lib/generate';
import { GROUP_ORDER } from '../../lib/bodymap';
import { COVERAGE_GROUPS, GROUP_LABEL, perGroupSets, groupTarget, coverageStatus, statusChip } from '../../lib/coverage';

const HAS_MAP = new Set<string>(GROUP_ORDER);
// The three session lengths the app actually offers — the whole scenario grid.
const TIMES = [30, 45, 60];

// What's being dragged: a queued variation from the tray, or an existing slot.
type PendingItem = { key: string; name: string; sets: number; weekday: number };
type DragItem =
  | { kind: 'tray'; key: string; name: string; sets: number }
  | { kind: 'slot'; weekday: number; index: number };

// Freeze the generated program into the app-facing shape: keep what the app needs
// to materialize (family/muscle + sets/reps/rest) PLUS display fields so the
// dashboard can render a locked day with the same card.
function toLockShape(program: GenDay[]): LockedDay[] {
  return program.map((d) => ({
    weekday: d.weekday,
    dayName: d.dayName,
    dayType: d.dayType,
    dropped: d.dropped,
    estMinutes: d.estMinutes,
    slots: d.slots.map((s) => ({
      familyKey: s.familyKey,
      muscleId: s.kind === 'muscle' ? s.muscle : null,
      sets: s.sets,
      reps: s.reps,
      rest: s.rest,
      muscle: s.muscle,
      label: s.label,
      group: s.group,
      kind: s.kind,
      slotId: s.slotId,
    })),
  }));
}

export default function Preview() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();
  const { locks, reload: reloadLocks } = useLockedPrograms();

  const [active, setActive] = useState<{ splitKey: string; minutes: number; goalKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  const lockedMap = locks ?? {};

  // Seed the active scenario once data lands.
  useEffect(() => {
    if (!active && splits?.length && goals?.length) {
      setActive({ splitKey: splits[0].key, minutes: 60, goalKey: goals[0].goal_key });
    }
  }, [active, splits, goals]);

  // Clear the waiting list + any drag when the scenario changes.
  useEffect(() => { setPending([]); setDragItem(null); }, [active?.splitKey, active?.minutes, active?.goalKey]);

  const recipeIdByType = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes ?? []) m.set(r.day_type, r.id);
    return m;
  }, [recipes]);

  const orderedSplits = useMemo(() => [...(splits ?? [])].sort((a, b) => a.sort_order - b.sort_order), [splits]);
  const total = orderedSplits.length * TIMES.length * (goals?.length ?? 0);
  const doneCount = Object.keys(lockedMap).length;

  // family key → its primary muscle id (first exercise), for placing a variation.
  const familyMuscle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of catalog?.exercises ?? []) {
      if (e.movement_family_key && e.primary_muscle_id && !(e.movement_family_key in m)) m[e.movement_family_key] = e.primary_muscle_id;
    }
    return m;
  }, [catalog]);

  function genFor(splitKey: string, minutes: number, goalKey: string): GenDay[] {
    const s = orderedSplits.find((x) => x.key === splitKey);
    const g = goals?.find((x) => x.goal_key === goalKey);
    if (!s || !g || !recipes || !catalog) return [];
    return generateProgram(s, recipes, g, minutes, catalog);
  }

  async function toggleLock(splitKey: string, minutes: number, goalKey: string) {
    if (busy) return;
    setBusy(true);
    const id = lockId(splitKey, minutes, goalKey);
    const res = lockedMap[id]
      ? await unlockProgram(splitKey, minutes, goalKey)
      : await lockProgram(splitKey, minutes, goalKey, toLockShape(genFor(splitKey, minutes, goalKey)));
    setBusy(false);
    if (res.error) { alert(`Couldn't save lock: ${res.error.message}`); return; }
    reloadLocks();
  }
  async function relock(splitKey: string, minutes: number, goalKey: string) {
    setBusy(true);
    const res = await lockProgram(splitKey, minutes, goalKey, toLockShape(genFor(splitKey, minutes, goalKey)));
    setBusy(false);
    if (res.error) { alert(`Couldn't update lock: ${res.error.message}`); return; }
    reloadLocks();
  }

  const loading = ls || lr || lg || lc || locks === null;
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!splits || !recipes || !goals || !catalog) return null;

  const split = active ? orderedSplits.find((s) => s.key === active.splitKey) : undefined;
  const goal = active ? goals.find((g) => g.goal_key === active.goalKey) : undefined;
  const activeId = active ? lockId(active.splitKey, active.minutes, active.goalKey) : '';
  const isLocked = !!lockedMap[activeId];
  const liveProgram = split && goal && active ? generateProgram(split, recipes, goal, active.minutes, catalog) : [];
  const program = isLocked ? (lockedMap[activeId] as unknown as GenDay[]) : liveProgram;
  const drift = isLocked && JSON.stringify(lockedMap[activeId]) !== JSON.stringify(toLockShape(liveProgram));

  // --- Per-scenario editing: everything below writes THIS scenario's locked
  // program (auto-locking/freezing the current program first), so no other split
  // is affected. A deep-copied editable base + a single save path.
  function lockedBase(): LockedDay[] {
    return (lockedMap[activeId] ?? toLockShape(liveProgram)).map((d) => ({ ...d, slots: [...d.slots] }));
  }
  async function saveLockedDays(newDays: LockedDay[]) {
    if (!active) return;
    setBusy(true);
    const res = await lockProgram(active.splitKey, active.minutes, active.goalKey, newDays);
    setBusy(false);
    if (res.error) { alert(`Couldn't save: ${res.error.message}`); return; }
    reloadLocks();
  }
  function buildSlot(familyKey: string, sets: number): LockedDay['slots'][number] {
    const fam = catalog!.familiesByKey.get(familyKey);
    const reps = Math.max(3, 10 + (goal?.rep_shift ?? 0));
    const rest = Math.min(180, Math.round((90 * (goal?.rest_multiplier ?? 1)) / 15) * 15);
    return {
      familyKey, muscleId: null, sets, reps, rest,
      muscle: familyMuscle[familyKey], label: fam?.display_name ?? familyKey,
      group: fam?.muscle_group_raw ?? null, kind: 'variation', slotId: null,
    };
  }
  // Insert a variation into a day at `index` (default: append).
  async function placeVariation(familyKey: string, sets: number, weekday: number, index?: number) {
    if (!active || !goal) return;
    const base = lockedBase();
    const day = base.find((d) => d.weekday === weekday);
    if (!day) return;
    day.slots.splice(index ?? day.slots.length, 0, buildSlot(familyKey, sets));
    await saveLockedDays(base);
  }
  // Move an existing slot to another position/day.
  async function moveSlot(fromW: number, fromI: number, toW: number, toI: number) {
    const base = lockedBase();
    const src = base.find((d) => d.weekday === fromW);
    const tgt = base.find((d) => d.weekday === toW);
    if (!src || !tgt) return;
    const [moved] = src.slots.splice(fromI, 1);
    if (!moved) return;
    let idx = toI;
    if (fromW === toW && toI > fromI) idx -= 1; // account for the removal shift
    tgt.slots.splice(idx, 0, moved);
    await saveLockedDays(base);
  }
  // Edit a slot's sets / reps / rest in place.
  async function updateSlot(weekday: number, index: number, patch: { sets?: number; reps?: number; rest?: number }) {
    const base = lockedBase();
    const day = base.find((d) => d.weekday === weekday);
    if (!day || !day.slots[index]) return;
    day.slots[index] = { ...day.slots[index], ...patch };
    await saveLockedDays(base);
  }
  // Remove a slot from a day.
  async function removeSlot(weekday: number, index: number) {
    const base = lockedBase();
    const day = base.find((d) => d.weekday === weekday);
    if (!day) return;
    day.slots.splice(index, 1);
    await saveLockedDays(base);
  }
  // Drop resolves to a place (from tray) or a move (existing slot).
  async function handleDrop(weekday: number, index: number) {
    const item = dragItem;
    setDragItem(null);
    if (!item) return;
    if (item.kind === 'tray') {
      await placeVariation(item.key, item.sets, weekday, index);
      setPending((p) => p.filter((x) => x.key !== item.key));
    } else if (!(item.weekday === weekday && (index === item.index || index === item.index + 1))) {
      await moveSlot(item.weekday, item.index, weekday, index);
    }
  }

  // Waiting-list handlers.
  const stagePending = (key: string, name: string) =>
    setPending((p) => (p.some((x) => x.key === key) ? p : [...p, { key, name, sets: 3, weekday: liveProgram[0]?.weekday ?? 2 }]));
  const patchPending = (key: string, patch: Partial<PendingItem>) =>
    setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const removePending = (key: string) => setPending((p) => p.filter((x) => x.key !== key));
  async function addPending(item: PendingItem) {
    await placeVariation(item.key, item.sets, item.weekday);
    removePending(item.key);
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
              locked={lockedMap}
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
                  disabled={busy}
                  onClick={() => toggleLock(active.splitKey, active.minutes, active.goalKey)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-50 ${isLocked ? 'bg-emerald-500 text-white' : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                >{isLocked ? '✓ Reviewed' : 'Mark reviewed'}</button>
              </div>
            </div>

            {drift && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <span>A recipe changed since you locked this — the frozen version below is what's kept (and what the app ships).</span>
                <button
                  onClick={() => relock(active.splitKey, active.minutes, active.goalKey)}
                  className="ml-3 rounded-md bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700"
                >Update to current</button>
              </div>
            )}

            <CoverageStrip
              program={program}
              catalog={catalog}
              busy={busy}
              pending={pending}
              onStage={stagePending}
              onPatchPending={patchPending}
              onRemovePending={removePending}
              onAddPending={addPending}
              onUpdateSlot={updateSlot}
              onDragStartTray={(item) => setDragItem({ kind: 'tray', key: item.key, name: item.name, sets: item.sets })}
              onDragEnd={() => setDragItem(null)}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {program.map((d, i) => (
                <DayCard
                  key={i}
                  day={d}
                  recipeId={d.dayType ? recipeIdByType.get(d.dayType) : undefined}
                  busy={busy}
                  onUpdateSlot={updateSlot}
                  onRemoveSlot={removeSlot}
                  dragging={!!dragItem}
                  onSlotDragStart={(weekday, index) => setDragItem({ kind: 'slot', weekday, index })}
                  onDragEnd={() => setDragItem(null)}
                  onDropAt={handleDrop}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SplitGroup({
  split, goals, locked, activeId, onSelect, onToggle,
}: {
  split: ContentSplit;
  goals: ContentGoal[];
  locked: Record<string, LockedDay[]>;
  activeId: string;
  onSelect: (minutes: number, goalKey: string) => void;
  onToggle: (minutes: number, goalKey: string) => void;
}) {
  const cells = TIMES.flatMap((m) => goals.map((g) => ({ minutes: m, goal: g, id: lockId(split.key, m, g.goal_key) })));
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

// Per-scenario coverage + authoring: weekly sets per group (fair-share target),
// every muscle and every variation beneath it (zeros included), and a waiting
// list to add a missing variation to a day of this scenario.
function CoverageStrip({ program, catalog, busy, pending, onStage, onPatchPending, onRemovePending, onAddPending, onUpdateSlot, onDragStartTray, onDragEnd }: {
  program: GenDay[];
  catalog: Catalog;
  busy: boolean;
  pending: PendingItem[];
  onStage: (key: string, name: string) => void;
  onPatchPending: (key: string, patch: Partial<PendingItem>) => void;
  onRemovePending: (key: string) => void;
  onAddPending: (item: PendingItem) => Promise<void>;
  onUpdateSlot: (weekday: number, index: number, patch: { sets?: number }) => void;
  onDragStartTray: (item: { key: string; name: string; sets: number }) => void;
  onDragEnd: () => void;
}) {
  const perGroup = perGroupSets(program);
  const totalSets = COVERAGE_GROUPS.reduce((t, g) => t + (perGroup[g] ?? 0), 0);
  const dayOptions = program.map((d) => ({ weekday: d.weekday, name: d.dayName }));

  // Where each family currently sits, so a single-slot family can be edited here.
  const familyLoc = useMemo(() => {
    const m: Record<string, { weekday: number; index: number }[]> = {};
    for (const d of program) d.slots.forEach((s, i) => { if (s.familyKey) (m[s.familyKey] ??= []).push({ weekday: d.weekday, index: i }); });
    return m;
  }, [program]);

  const familyMuscle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of catalog.exercises) if (e.movement_family_key && e.primary_muscle_id && !(e.movement_family_key in m)) m[e.movement_family_key] = e.primary_muscle_id;
    return m;
  }, [catalog]);

  // Sets delivered per muscle id and per family key.
  const { perMuscle, perFamily } = useMemo(() => {
    const pm: Record<string, number> = {};
    const pf: Record<string, number> = {};
    for (const d of program) for (const s of d.slots) {
      if (s.muscle) pm[s.muscle] = (pm[s.muscle] ?? 0) + s.sets;
      if (s.familyKey) pf[s.familyKey] = (pf[s.familyKey] ?? 0) + s.sets;
    }
    return { perMuscle: pm, perFamily: pf };
  }, [program]);

  // group → its muscles (catalog order), each with its families (catalog order).
  const groupData = useMemo(() => {
    const famByMuscle: Record<string, { key: string; name: string; order: number }[]> = {};
    for (const f of catalog.families) {
      const mid = familyMuscle[f.key];
      if (!mid) continue;
      (famByMuscle[mid] ??= []).push({ key: f.key, name: f.display_name, order: f.sort_order });
    }
    for (const k of Object.keys(famByMuscle)) famByMuscle[k].sort((a, b) => a.order - b.order);
    const byGroup: Record<string, { id: string; name: string; families: { key: string; name: string; order: number }[] }[]> = {};
    for (const m of [...catalog.muscles].sort((a, b) => a.sort_order - b.sort_order)) {
      (byGroup[m.group_raw] ??= []).push({ id: m.id, name: m.name, families: famByMuscle[m.id] ?? [] });
    }
    return byGroup;
  }, [catalog, familyMuscle]);

  const stagedKeys = new Set(pending.map((p) => p.key));

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase text-slate-500">Weekly coverage</span>
        <span className="text-xs text-slate-400">{totalSets} sets · sets / target · <span className="text-rose-600">red</span> under · <span className="text-amber-600">amber</span> over · <span className="text-indigo-600">+</span> add a variation</span>
      </div>

      <div className="grid gap-2">
        {COVERAGE_GROUPS.map((g) => {
          const n = perGroup[g] ?? 0;
          const target = n > 0 ? groupTarget(perGroup, g) : 0;
          const status = coverageStatus(n, target);
          const untrained = n === 0;
          const muscles = groupData[g] ?? [];
          return (
            <div key={g}>
              <div className="flex items-center gap-2">
                <div className={`flex w-32 shrink-0 items-center gap-1.5 ${untrained ? 'opacity-60' : ''}`}>
                  {HAS_MAP.has(g) ? <img src={`/maps/${g}.svg`} alt="" className="size-6 shrink-0 object-contain" /> : <span className="size-6 shrink-0" />}
                  <span className="text-sm font-semibold text-slate-700">{GROUP_LABEL[g]}</span>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-bold tabular-nums ${untrained ? 'text-slate-400' : statusChip(status)}`}>{n}/{target}</span>
              </div>
              <div className="mt-0.5 grid gap-0.5 pl-8">
                {muscles.map((m) => {
                  const ms = perMuscle[m.id] ?? 0;
                  return (
                    <div key={m.id} className="flex items-baseline gap-2 text-xs">
                      <span className={`w-24 shrink-0 ${ms === 0 ? 'text-slate-400' : 'text-slate-600'}`}>{m.name} <span className="font-bold tabular-nums">{ms}</span></span>
                      <div className="flex flex-1 flex-wrap gap-1">
                        {m.families.map((f) => {
                          const fs = perFamily[f.key] ?? 0;
                          const locs = familyLoc[f.key] ?? [];
                          if (fs > 0) {
                            // On one day → editable count here; on several → edit on the day card.
                            const single = locs.length === 1 ? locs[0] : null;
                            return (
                              <span key={f.key} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-slate-600">
                                {f.name}
                                {single ? (
                                  <span className="font-semibold text-slate-900"><EditableNum value={fs} onCommit={(n) => onUpdateSlot(single.weekday, single.index, { sets: n })} width="w-7" /></span>
                                ) : (
                                  <span className="font-semibold tabular-nums text-slate-900">{fs}</span>
                                )}
                              </span>
                            );
                          }
                          const staged = stagedKeys.has(f.key);
                          return (
                            <button
                              key={f.key}
                              disabled={staged}
                              onClick={() => onStage(f.key, f.name)}
                              className={`rounded border border-dashed px-1.5 py-0.5 ${staged ? 'border-indigo-300 bg-indigo-50 text-indigo-500' : 'border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600'}`}
                            >{staged ? '✓ ' : '+ '}{f.name}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pending.length > 0 && (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-2">
          <div className="mb-1.5 text-xs font-bold text-indigo-700">To place ({pending.length}) — drag onto a day, or set the count + day and Add. This locks the scenario.</div>
          <div className="grid gap-1.5">
            {pending.map((p) => (
              <div
                key={p.key}
                draggable
                onDragStart={() => onDragStartTray({ key: p.key, name: p.name, sets: p.sets })}
                onDragEnd={onDragEnd}
                className="flex cursor-move items-center gap-2 rounded border border-indigo-200 bg-white px-2 py-1 text-xs"
              >
                <span className="text-slate-300">⠿</span>
                <span className="flex-1 font-semibold text-slate-800">{p.name}</span>
                <div className="flex items-center overflow-hidden rounded border border-slate-300 bg-white">
                  <button onClick={() => onPatchPending(p.key, { sets: Math.max(1, p.sets - 1) })} className="px-1.5 text-slate-500 hover:bg-slate-100">−</button>
                  <span className="w-12 text-center tabular-nums">{p.sets} set{p.sets > 1 ? 's' : ''}</span>
                  <button onClick={() => onPatchPending(p.key, { sets: p.sets + 1 })} className="px-1.5 text-slate-500 hover:bg-slate-100">+</button>
                </div>
                <select value={p.weekday} onChange={(e) => onPatchPending(p.key, { weekday: parseInt(e.target.value, 10) })} className="rounded border border-slate-300 bg-white px-1.5 py-1">
                  {dayOptions.map((d) => <option key={d.weekday} value={d.weekday}>{d.name}</option>)}
                </select>
                <button disabled={busy} onClick={() => onAddPending(p)} className="rounded bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Add</button>
                <button onClick={() => onRemovePending(p.key)} className="px-1 text-slate-400 hover:text-slate-700">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Plain number as text; click it to edit inline (commits on blur / Enter).
function EditableNum({ value, onCommit, width = 'w-8' }: { value: number; onCommit: (n: number) => void; width?: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => { const n = parseInt(v || '0', 10); if (Number.isFinite(n) && n > 0 && n !== value) onCommit(n); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
        className={`${width} rounded border border-indigo-400 bg-white px-1 text-right tabular-nums text-slate-800 outline-none`}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="tabular-nums hover:text-indigo-600 hover:underline">{value}</button>
  );
}


// A slim drop target between/around slots that expands when dragged over.
function DropZone({ onDrop }: { onDrop: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <li
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(); }}
      className={`mx-3 rounded transition-all ${over ? 'my-1 h-6 border-2 border-dashed border-indigo-400 bg-indigo-50' : 'h-1'}`}
    />
  );
}

function DayCard({ day, recipeId, busy, onUpdateSlot, onRemoveSlot, dragging, onSlotDragStart, onDragEnd, onDropAt }: {
  day: GenDay;
  recipeId?: string;
  busy: boolean;
  onUpdateSlot: (weekday: number, index: number, patch: { sets?: number; reps?: number; rest?: number }) => void;
  onRemoveSlot: (weekday: number, index: number) => void;
  dragging: boolean;
  onSlotDragStart: (weekday: number, index: number) => void;
  onDragEnd: () => void;
  onDropAt: (weekday: number, index: number) => void;
}) {
  const totalSets = day.slots.reduce((n, s) => n + s.sets, 0);
  return (
    <div className={`rounded-xl border bg-white ${dragging ? 'border-indigo-200' : 'border-slate-200'}`}>
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-bold text-slate-900">
          <span className="text-slate-400">{weekdayLabel(day.weekday)}</span> {day.dayName}
        </span>
        <div className="flex items-baseline gap-2">
          {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{day.slots.length} ex · {totalSets} sets · ~{day.estMinutes}m</span>}
          {recipeId && <Link to={`/recipes/${recipeId}`} className="text-xs font-semibold text-indigo-500 hover:underline">recipe</Link>}
        </div>
      </div>
      {day.note ? (
        <div
          onDragOver={dragging ? (e) => e.preventDefault() : undefined}
          onDrop={dragging ? () => onDropAt(day.weekday, 0) : undefined}
          className={`px-4 py-3 text-sm text-amber-600 ${dragging ? 'ring-2 ring-inset ring-indigo-200' : ''}`}
        >{day.note}{dragging ? ' — drop here to add' : ''}</div>
      ) : (
        <ul>
          {day.slots.map((s, i) => (
            <Fragment key={i}>
              {dragging && <DropZone onDrop={() => onDropAt(day.weekday, i)} />}
              <li className="flex items-center gap-2 border-b border-slate-50 px-3 py-2 text-sm">
                <span
                  draggable
                  onDragStart={() => onSlotDragStart(day.weekday, i)}
                  onDragEnd={onDragEnd}
                  className="cursor-move text-slate-300 hover:text-slate-500"
                  title="Drag to move"
                >⠿</span>
                {s.group && HAS_MAP.has(s.group) ? (
                  <img src={`/maps/${s.group}.svg`} alt="" className="size-7 shrink-0 object-contain" />
                ) : (
                  <span className="size-7 shrink-0" />
                )}
                <span className="flex-1 truncate font-semibold text-slate-800">{s.label}</span>
                {s.kind === 'muscle' && <span className="text-[10px] font-bold uppercase text-indigo-500">musc</span>}
                <span className="flex items-center gap-1 text-slate-500">
                  <EditableNum value={s.sets} onCommit={(n) => onUpdateSlot(day.weekday, i, { sets: n })} width="w-6" />
                  <span className="text-slate-300">×</span>
                  <EditableNum value={s.reps} onCommit={(n) => onUpdateSlot(day.weekday, i, { reps: n })} width="w-8" />
                </span>
                <span className="flex items-center text-xs text-slate-400">
                  <EditableNum value={s.rest} onCommit={(n) => onUpdateSlot(day.weekday, i, { rest: n })} width="w-9" />s
                </span>
                <button
                  disabled={busy}
                  onClick={() => onRemoveSlot(day.weekday, i)}
                  className="text-slate-300 hover:text-rose-500 disabled:opacity-40"
                  title="Remove exercise"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </li>
            </Fragment>
          ))}
          {dragging && <DropZone onDrop={() => onDropAt(day.weekday, day.slots.length)} />}
        </ul>
      )}
    </div>
  );
}
