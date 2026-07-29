import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useSplits, useRecipes, useGoals, useCatalog, useLockedPrograms,
  saveProgram, unlockProgram, lockId,
  type Catalog, type ContentGoal, type ContentSplit, type LockedDay,
} from '../../lib/content';
import { generateProgram, slotMinutes, weekdayLabel, type GenDay } from '../../lib/generate';
import { GROUP_ORDER } from '../../lib/bodymap';
import { COVERAGE_GROUPS, GROUP_LABEL, perGroupSets, groupTarget, coverageStatus, statusChip } from '../../lib/coverage';

const HAS_MAP = new Set<string>(GROUP_ORDER);
// Groups you can slot as a WHOLE group ("Biceps" = pick any biceps exercise).
// Only the interchangeable ones — legs/back/shoulders are too broad.
const INTERCHANGEABLE_GROUPS = new Set(['chest', 'biceps', 'triceps', 'core', 'forearms']);
// The three session lengths the app actually offers — the whole scenario grid.
const TIMES = [30, 45, 60];

// A slot is either a specific variation (movement family) or a whole muscle.
type SlotKind = 'variation' | 'muscle';
// `key` is the family key (variation) or the muscle id (muscle).
type PendingItem = { slotKind: SlotKind; key: string; name: string; group: string | null; sets: number; weekday: number };
type DragItem =
  | { kind: 'tray'; slotKind: SlotKind; key: string; sets: number }
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
  const { locks, reviewed: reviewedMap, reload: reloadLocks } = useLockedPrograms();

  const [active, setActive] = useState<{ splitKey: string; minutes: number; goalKey: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [editingSlot, setEditingSlot] = useState<{ weekday: number; index: number } | null>(null);
  const [scenariosOpen, setScenariosOpen] = useState(() => localStorage.getItem('pd_scenarios_open') !== '0');
  useEffect(() => { localStorage.setItem('pd_scenarios_open', scenariosOpen ? '1' : '0'); }, [scenariosOpen]);

  const lockedMap = locks ?? {};

  // Seed the active scenario once data lands — restore the last one viewed if it's
  // still valid, otherwise a sensible default.
  useEffect(() => {
    if (active || !splits?.length || !goals?.length) return;
    try {
      const saved = JSON.parse(localStorage.getItem('pd_preview_active') || 'null');
      if (
        saved &&
        typeof saved.minutes === 'number' &&
        splits.some((s) => s.key === saved.splitKey) &&
        goals.some((g) => g.goal_key === saved.goalKey)
      ) {
        setActive(saved);
        return;
      }
    } catch { /* ignore bad/absent value */ }
    setActive({ splitKey: splits[0].key, minutes: 60, goalKey: goals[0].goal_key });
  }, [active, splits, goals]);

  // Remember the last-viewed scenario across reloads.
  useEffect(() => {
    if (active) localStorage.setItem('pd_preview_active', JSON.stringify(active));
  }, [active]);

  // Clear the waiting list + any drag/edit when the scenario changes.
  useEffect(() => { setPending([]); setDragItem(null); setEditingSlot(null); }, [active?.splitKey, active?.minutes, active?.goalKey]);

  const recipeIdByType = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes ?? []) m.set(r.day_type, r.id);
    return m;
  }, [recipes]);

  const orderedSplits = useMemo(() => [...(splits ?? [])].sort((a, b) => a.sort_order - b.sort_order), [splits]);
  const total = orderedSplits.length * TIMES.length * (goals?.length ?? 0);
  const doneCount = Object.values(reviewedMap).filter(Boolean).length;

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

  // Toggle the review checkmark. Marking reviewed freezes the current program if
  // there's no working copy yet; unmarking keeps the saved copy (just unreviewed).
  async function toggleReviewed(splitKey: string, minutes: number, goalKey: string) {
    if (busy) return;
    const id = lockId(splitKey, minutes, goalKey);
    const nowReviewed = !reviewedMap[id];
    const days = lockedMap[id] ?? toLockShape(genFor(splitKey, minutes, goalKey));
    setBusy(true);
    const res = await saveProgram(splitKey, minutes, goalKey, days, nowReviewed);
    setBusy(false);
    if (res.error) { alert(`Couldn't save: ${res.error.message}`); return; }
    reloadLocks();
  }
  // Discard the custom program — revert this scenario to live generation.
  async function resetToGenerated(splitKey: string, minutes: number, goalKey: string) {
    if (!confirm('Discard your edits and revert this scenario to the generated version?')) return;
    setBusy(true);
    const res = await unlockProgram(splitKey, minutes, goalKey);
    setBusy(false);
    if (res.error) { alert(`Couldn't reset: ${res.error.message}`); return; }
    reloadLocks();
  }

  const loading = ls || lr || lg || lc || locks === null;
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!splits || !recipes || !goals || !catalog) return null;

  const split = active ? orderedSplits.find((s) => s.key === active.splitKey) : undefined;
  const goal = active ? goals.find((g) => g.goal_key === active.goalKey) : undefined;
  const activeId = active ? lockId(active.splitKey, active.minutes, active.goalKey) : '';
  const hasCustom = !!lockedMap[activeId];   // a saved working copy exists (edited or reviewed)
  const isReviewed = !!reviewedMap[activeId];
  const liveProgram = split && goal && active ? generateProgram(split, recipes, goal, active.minutes, catalog) : [];
  const program = hasCustom ? (lockedMap[activeId] as unknown as GenDay[]) : liveProgram;

  // --- Per-scenario editing: everything below writes THIS scenario's locked
  // program (auto-locking/freezing the current program first), so no other split
  // is affected. A deep-copied editable base + a single save path.
  function lockedBase(): LockedDay[] {
    return (lockedMap[activeId] ?? toLockShape(liveProgram)).map((d) => ({ ...d, slots: [...d.slots] }));
  }
  // Re-shape the OTHER goal's program to match this structure (same variations,
  // order, days), keeping its own per-slot loading where a slot matches, and
  // goal-appropriate defaults for anything new. Keeps hypertrophy/strength in
  // structural sync while letting sets/reps/rest differ per goal.
  function deriveForGoal(structure: LockedDay[], goalKey: string, otherBase: LockedDay[]): LockedDay[] {
    const g = (goals ?? []).find((x) => x.goal_key === goalKey);
    const reps = Math.max(3, 10 + (g?.rep_shift ?? 0));
    const rest = Math.min(180, Math.round((90 * (g?.rest_multiplier ?? 1)) / 15) * 15);
    const setsBase = Math.max(2, 3 + (g?.set_shift ?? 0));
    const prevByDay = new Map(otherBase.map((d) => [d.weekday, [...d.slots]]));
    return structure.map((d) => {
      const used: Record<string, number> = {};
      return {
        ...d,
        slots: d.slots.map((s) => {
          const idk = `${s.familyKey ?? ''}|${s.muscleId ?? ''}`;
          const occ = used[idk] ?? 0; used[idk] = occ + 1;
          const prev = (prevByDay.get(d.weekday) ?? []).filter((ps) => `${ps.familyKey ?? ''}|${ps.muscleId ?? ''}` === idk)[occ];
          return prev
            ? { ...s, sets: prev.sets, reps: prev.reps, rest: prev.rest }   // keep the other goal's loading
            : { ...s, sets: setsBase, reps, rest };                          // new slot → goal defaults
        }),
      };
    });
  }

  // Save the current goal. When `mirrorStructure` (a variation add/move/remove),
  // also re-shape the other goal to the same structure. Loading edits don't mirror.
  async function saveLockedDays(newDays: LockedDay[], mirrorStructure = false) {
    if (!active) return;
    setBusy(true);
    let res = await saveProgram(active.splitKey, active.minutes, active.goalKey, newDays, isReviewed);
    const other = (goals ?? []).find((g) => g.goal_key !== active.goalKey);
    if (!res.error && mirrorStructure && other) {
      const otherId = lockId(active.splitKey, active.minutes, other.goal_key);
      const otherBase = lockedMap[otherId] ?? toLockShape(genFor(active.splitKey, active.minutes, other.goal_key));
      const otherDays = deriveForGoal(newDays, other.goal_key, otherBase);
      res = await saveProgram(active.splitKey, active.minutes, other.goal_key, otherDays, reviewedMap[otherId] ?? false);
    }
    setBusy(false);
    if (res.error) { alert(`Couldn't save: ${res.error.message}`); return; }
    reloadLocks();
  }
  // Build a slot for a variation (key = family key) or a whole muscle (key = muscle id).
  function buildSlot(slotKind: SlotKind, key: string, sets: number): LockedDay['slots'][number] {
    const reps = Math.max(3, 10 + (goal?.rep_shift ?? 0));
    const rest = Math.min(180, Math.round((90 * (goal?.rest_multiplier ?? 1)) / 15) * 15);
    if (slotKind === 'muscle') {
      const m = catalog!.musclesById.get(key);
      return { familyKey: null, muscleId: key, sets, reps, rest, muscle: key, label: m?.name ?? key, group: m?.group_raw ?? null, kind: 'muscle', slotId: null };
    }
    const fam = catalog!.familiesByKey.get(key);
    return { familyKey: key, muscleId: null, sets, reps, rest, muscle: familyMuscle[key], label: fam?.display_name ?? key, group: fam?.muscle_group_raw ?? null, kind: 'variation', slotId: null };
  }
  // Insert a slot into a day at `index` (default: append).
  async function placeSlot(slotKind: SlotKind, key: string, sets: number, weekday: number, index?: number) {
    if (!active || !goal) return;
    const base = lockedBase();
    const day = base.find((d) => d.weekday === weekday);
    if (!day) return;
    day.slots.splice(index ?? day.slots.length, 0, buildSlot(slotKind, key, sets));
    await saveLockedDays(base, true); // structure → mirror to the other goal
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
    await saveLockedDays(base, true); // structure → mirror to the other goal
  }
  // Edit a slot's sets / reps / rest in place — PER GOAL, does not mirror.
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
    await saveLockedDays(base, true); // structure → mirror to the other goal
  }
  // Drop resolves to a place (from tray) or a move (existing slot).
  async function handleDrop(weekday: number, index: number) {
    const item = dragItem;
    setDragItem(null);
    if (!item) return;
    if (item.kind === 'tray') {
      await placeSlot(item.slotKind, item.key, item.sets, weekday, index);
      setPending((p) => p.filter((x) => x.key !== item.key));
    } else if (!(item.weekday === weekday && (index === item.index || index === item.index + 1))) {
      await moveSlot(item.weekday, item.index, weekday, index);
    }
  }

  // Waiting-list handlers.
  const stagePending = (slotKind: SlotKind, key: string, name: string, group: string | null) =>
    setPending((p) => (p.some((x) => x.key === key) ? p : [...p, { slotKind, key, name, group, sets: 3, weekday: liveProgram[0]?.weekday ?? 2 }]));
  const patchPending = (key: string, patch: Partial<PendingItem>) =>
    setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const removePending = (key: string) => setPending((p) => p.filter((x) => x.key !== key));

  return (
    <div className="flex h-full">
      {/* ---- Scenario checklist (collapsible) ---- */}
      {scenariosOpen ? (
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Scenarios</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tabular-nums text-slate-500">{doneCount} / {total} reviewed</span>
                <button onClick={() => setScenariosOpen(false)} className="text-slate-400 hover:text-slate-700" title="Collapse">«</button>
              </div>
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
                reviewed={reviewedMap}
                custom={lockedMap}
                activeId={activeId}
                onSelect={(minutes, goalKey) => setActive({ splitKey: s.key, minutes, goalKey })}
                onToggle={(minutes, goalKey) => toggleReviewed(s.key, minutes, goalKey)}
              />
            ))}
          </div>
        </aside>
      ) : (
        <button
          onClick={() => setScenariosOpen(true)}
          className="flex w-8 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 hover:bg-slate-100"
          title="Show scenarios"
        >
          <span className="rotate-180 text-xs font-bold tracking-wide text-slate-500 [writing-mode:vertical-rl]">Scenarios »</span>
        </button>
      )}

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
                  {isReviewed && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ Reviewed</span>}
                  {hasCustom && !isReviewed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Edited · not reviewed</span>}
                </h1>
                <p className="text-sm text-slate-500">
                  {goal.display_name} · {active.minutes} min
                  {hasCustom ? ' · your saved version' : ' · generated'}
                  {hasCustom && <> · <button onClick={() => resetToGenerated(active.splitKey, active.minutes, active.goalKey)} className="text-rose-500 hover:underline">reset to generated</button></>}
                </p>
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
                  onClick={() => toggleReviewed(active.splitKey, active.minutes, active.goalKey)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold disabled:opacity-50 ${isReviewed ? 'bg-emerald-500 text-white' : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                >{isReviewed ? '✓ Reviewed' : 'Mark reviewed'}</button>
              </div>
            </div>

            <CoverageStrip
              program={program}
              catalog={catalog}
              busy={busy}
              pending={pending}
              onStage={stagePending}
              onPatchPending={patchPending}
              onRemovePending={removePending}
              onDragStartTray={(item) => setDragItem({ kind: 'tray', slotKind: item.slotKind, key: item.key, sets: item.sets })}
              onDragEnd={() => setDragItem(null)}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {program.map((d, i) => (
                <DayCard
                  key={i}
                  day={d}
                  recipeId={d.dayType ? recipeIdByType.get(d.dayType) : undefined}
                  busy={busy}
                  onOpenEditor={(weekday, index) => setEditingSlot({ weekday, index })}
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

      {(() => {
        const es = editingSlot;
        const s = es ? program.find((d) => d.weekday === es.weekday)?.slots[es.index] : undefined;
        if (!es || !s) return null;
        return (
          <SlotEditor
            slot={{ label: s.label, sets: s.sets, reps: s.reps, rest: s.rest }}
            saving={busy}
            onSave={(patch) => { updateSlot(es.weekday, es.index, patch); setEditingSlot(null); }}
            onClose={() => setEditingSlot(null)}
          />
        );
      })()}
    </div>
  );
}

function SplitGroup({
  split, goals, reviewed, custom, activeId, onSelect, onToggle,
}: {
  split: ContentSplit;
  goals: ContentGoal[];
  reviewed: Record<string, boolean>;
  custom: Record<string, LockedDay[]>;
  activeId: string;
  onSelect: (minutes: number, goalKey: string) => void;
  onToggle: (minutes: number, goalKey: string) => void;
}) {
  const cells = TIMES.flatMap((m) => goals.map((g) => ({ minutes: m, goal: g, id: lockId(split.key, m, g.goal_key) })));
  const done = cells.filter((c) => reviewed[c.id]).length;
  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-xs font-bold text-slate-700">{split.display_name}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${done === cells.length ? 'text-emerald-600' : 'text-slate-400'}`}>{done}/{cells.length}</span>
      </div>
      <div className="space-y-1">
        {cells.map((c) => {
          const isActive = c.id === activeId;
          const isReviewed = !!reviewed[c.id];
          const isEdited = !!custom[c.id] && !isReviewed;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.minutes, c.goal.goal_key)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs ${isActive ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-100'}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(c.minutes, c.goal.goal_key); }}
                className={`grid size-4 shrink-0 place-items-center rounded border ${isReviewed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}
                title={isReviewed ? 'Reviewed — click to unmark' : 'Mark reviewed'}
              >{isReviewed && <span className="text-[9px] leading-none">✓</span>}</button>
              <span className={`flex-1 ${isReviewed ? 'text-slate-400' : 'text-slate-700'}`}>{c.minutes}m · {c.goal.display_name}</span>
              {isEdited && <span className="size-1.5 rounded-full bg-amber-400" title="Edited, not reviewed" />}
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
function CoverageStrip({ program, catalog, busy, pending, onStage, onPatchPending, onRemovePending, onDragStartTray, onDragEnd }: {
  program: GenDay[];
  catalog: Catalog;
  busy: boolean;
  pending: PendingItem[];
  onStage: (slotKind: SlotKind, key: string, name: string, group: string | null) => void;
  onPatchPending: (key: string, patch: Partial<PendingItem>) => void;
  onRemovePending: (key: string) => void;
  onDragStartTray: (item: { slotKind: SlotKind; key: string; sets: number }) => void;
  onDragEnd: () => void;
}) {
  const perGroup = perGroupSets(program);
  const totalSets = COVERAGE_GROUPS.reduce((t, g) => t + (perGroup[g] ?? 0), 0);

  const [viewingFamily, setViewingFamily] = useState<{ key: string; name: string } | null>(null);

  const familyMuscle = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of catalog.exercises) if (e.movement_family_key && e.primary_muscle_id && !(e.movement_family_key in m)) m[e.movement_family_key] = e.primary_muscle_id;
    return m;
  }, [catalog]);

  // The exercises that belong to each movement family, for the peek card.
  const exByFamily = useMemo(() => {
    const m: Record<string, { id: string; name: string; muscle: string | null }[]> = {};
    for (const e of catalog.exercises) {
      if (!e.movement_family_key) continue;
      (m[e.movement_family_key] ??= []).push({ id: e.id, name: e.name, muscle: e.primary_muscle_id ? catalog.musclesById.get(e.primary_muscle_id)?.name ?? null : null });
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.name.localeCompare(b.name));
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
              <div className="flex items-center gap-1.5">
                <div className={`flex shrink-0 items-center gap-1.5 ${untrained ? 'opacity-60' : ''}`}>
                  {HAS_MAP.has(g) ? <img src={`/maps/${g}.svg`} alt="" className="size-6 shrink-0 object-contain" /> : <span className="size-6 shrink-0" />}
                  <span className="text-base font-bold text-slate-800">{GROUP_LABEL[g]}</span>
                </div>
                {INTERCHANGEABLE_GROUPS.has(g) && (() => {
                  const gk = `group.${g}`;
                  const gStaged = stagedKeys.has(gk);
                  return (
                    <button
                      disabled={gStaged}
                      onClick={() => onStage('variation', gk, GROUP_LABEL[g], g)}
                      title={`Add a whole-${GROUP_LABEL[g]} slot — pick any ${GROUP_LABEL[g]} exercise at log time`}
                      className={`shrink-0 text-lg font-bold leading-none ${gStaged ? 'text-indigo-400' : 'text-slate-300 hover:text-indigo-600'}`}
                    >{gStaged ? '✓' : '+'}</button>
                  );
                })()}
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-sm font-bold tabular-nums ${untrained ? 'text-slate-400' : statusChip(status)}`}>{n}/{target}</span>
              </div>
              <div className="mt-0.5 grid gap-0.5 pl-8">
                {muscles.map((m) => {
                  const ms = perMuscle[m.id] ?? 0;
                  const muscleStaged = stagedKeys.has(m.id);
                  return (
                    <div key={m.id} className="flex items-baseline gap-2 text-xs">
                      <span className={`flex w-28 shrink-0 items-baseline gap-1 text-sm ${ms === 0 ? 'text-slate-400' : 'text-slate-600'}`}>
                        <button
                          disabled={muscleStaged}
                          onClick={() => onStage('muscle', m.id, m.name, g)}
                          title={`Add a "${m.name}" muscle slot (resolves at log time)`}
                          className={muscleStaged ? 'text-indigo-400' : 'text-slate-300 hover:text-indigo-600'}
                        >{muscleStaged ? '✓' : '+'}</button>
                        {m.name} <span className="font-bold tabular-nums">{ms}</span>
                      </span>
                      <div className="flex flex-1 flex-wrap gap-1">
                        {m.families.map((f) => {
                          const fs = perFamily[f.key] ?? 0;
                          const staged = stagedKeys.has(f.key);
                          // Always offer "+" — even for a variation already in the program,
                          // so you can add ANOTHER instance (same variation on a 2nd day).
                          return (
                            <span
                              key={f.key}
                              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 ${fs > 0 ? 'border-slate-200 bg-white text-slate-600' : 'border-dashed border-slate-300 text-slate-400'}`}
                            >
                              <button onClick={() => setViewingFamily({ key: f.key, name: f.name })} className="hover:text-indigo-600 hover:underline" title="See exercises in this variation">{f.name}</button>
                              {fs > 0 && <span className="font-semibold tabular-nums text-slate-900">{fs}</span>}
                              <button
                                disabled={staged}
                                onClick={() => onStage('variation', f.key, f.name, g)}
                                title={fs > 0 ? `Add another ${f.name}` : `Add ${f.name}`}
                                className={staged ? 'text-indigo-400' : 'text-slate-300 hover:text-indigo-600'}
                              >{staged ? '✓' : '+'}</button>
                            </span>
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
          <div className="mb-1.5 text-xs font-bold text-indigo-700">To place ({pending.length}) — drag each onto the day and spot you want</div>
          <div className="grid gap-1.5">
            {pending.map((p) => {
              const grp = p.group;
              return (
                <div
                  key={p.key}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'tray'); onDragStartTray({ slotKind: p.slotKind, key: p.key, sets: p.sets }); }}
                  onDragEnd={onDragEnd}
                  className="flex cursor-move items-center gap-2 rounded-lg border border-indigo-200 bg-white px-2 py-2 text-sm shadow-sm"
                >
                  <span className="text-slate-300" title="Drag to a day">⠿</span>
                  {grp && HAS_MAP.has(grp) ? (
                    <img src={`/maps/${grp}.svg`} alt="" className="size-7 shrink-0 object-contain" />
                  ) : (
                    <span className="size-7 shrink-0" />
                  )}
                  <span className="flex-1 font-semibold text-slate-800">{p.name}</span>
                  {p.slotKind === 'muscle' && <span className="shrink-0 text-[10px] font-bold uppercase text-indigo-500">muscle</span>}
                  <div className="flex shrink-0 items-center overflow-hidden rounded border border-slate-200">
                    <button onClick={() => onPatchPending(p.key, { sets: Math.max(1, p.sets - 1) })} className="px-1.5 text-slate-500 hover:bg-slate-100">−</button>
                    <span className="w-9 text-center text-xs tabular-nums text-slate-600">{p.sets} ×</span>
                    <button onClick={() => onPatchPending(p.key, { sets: p.sets + 1 })} className="px-1.5 text-slate-500 hover:bg-slate-100">+</button>
                  </div>
                  <button disabled={busy} onClick={() => onRemovePending(p.key)} className="shrink-0 text-slate-300 hover:text-rose-500 disabled:opacity-40" title="Remove from list">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewingFamily && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setViewingFamily(null)}>
          <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="font-bold text-slate-900">{viewingFamily.name}</h3>
                <p className="text-xs text-slate-500">{(exByFamily[viewingFamily.key] ?? []).length} exercises in this variation</p>
              </div>
              <button onClick={() => setViewingFamily(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <ul className="flex-1 divide-y divide-slate-50 overflow-y-auto">
              {(exByFamily[viewingFamily.key] ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-semibold text-slate-800">{e.name}</span>
                  {e.muscle && <span className="text-xs text-slate-400">{e.muscle}</span>}
                </li>
              ))}
              {(exByFamily[viewingFamily.key] ?? []).length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-400">No exercises tagged into this variation yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// A spacious editor card for one exercise's sets / reps / rest.
function SlotEditor({ slot, saving, onSave, onClose }: {
  slot: { label: string; sets: number; reps: number; rest: number };
  saving: boolean;
  onSave: (patch: { sets: number; reps: number; rest: number }) => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(slot.sets);
  const [reps, setReps] = useState(slot.reps);
  const [rest, setRest] = useState(slot.rest);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-slate-900">{slot.label}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="grid gap-3">
          <Stepper label="Sets" value={sets} min={1} step={1} onChange={setSets} />
          <Stepper label="Reps" value={reps} min={1} step={1} onChange={setReps} />
          <Stepper label="Rest" value={rest} min={0} step={15} suffix="s" onChange={setRest} />
        </div>
        <button
          disabled={saving}
          onClick={() => onSave({ sets, reps, rest })}
          className="mt-5 w-full rounded-xl bg-indigo-600 py-2.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >Save</button>
      </div>
    </div>
  );
}

function Stepper({ label, value, min, step, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  step: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onChange(Math.max(min, value - step))} className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200">−</button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, parseInt(e.target.value || '0', 10)))}
          className="w-16 text-center text-2xl font-bold tabular-nums text-slate-900 outline-none"
        />
        {suffix && <span className="w-3 text-sm text-slate-400">{suffix}</span>}
        <button onClick={() => onChange(value + step)} className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl font-bold text-slate-600 hover:bg-slate-200">+</button>
      </div>
    </div>
  );
}

// A slim drop target between/around slots that expands when dragged over.
function DropZone({ onDrop }: { onDrop: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <li
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
      className={`mx-3 rounded transition-all ${over ? 'my-1 h-7 border-2 border-dashed border-indigo-400 bg-indigo-50' : 'h-1.5 bg-slate-100'}`}
    />
  );
}

function DayCard({ day, recipeId, busy, onOpenEditor, onRemoveSlot, dragging, onSlotDragStart, onDragEnd, onDropAt }: {
  day: GenDay;
  recipeId?: string;
  busy: boolean;
  onOpenEditor: (weekday: number, index: number) => void;
  onRemoveSlot: (weekday: number, index: number) => void;
  dragging: boolean;
  onSlotDragStart: (weekday: number, index: number) => void;
  onDragEnd: () => void;
  onDropAt: (weekday: number, index: number) => void;
}) {
  const totalSets = day.slots.reduce((n, s) => n + s.sets, 0);
  // Recompute the estimate from the CURRENT slots (sets + rest) via the shared
  // slotMinutes, so edits update live and it matches the app's estimate.
  const estMin = Math.round(day.slots.reduce((t, s) => t + slotMinutes(s.sets, s.rest), 0));
  return (
    <div className={`rounded-xl border bg-white ${dragging ? 'border-indigo-200' : 'border-slate-200'}`}>
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-bold text-slate-900">
          <span className="text-slate-400">{weekdayLabel(day.weekday)}</span> {day.dayName}
        </span>
        <div className="flex items-baseline gap-2">
          {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{day.slots.length} ex · {totalSets} sets · ~{estMin}m</span>}
          {recipeId && <Link to={`/recipes/${recipeId}`} className="text-xs font-semibold text-indigo-500 hover:underline">recipe</Link>}
        </div>
      </div>
      {day.note ? (
        <div
          onDragOver={dragging ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } : undefined}
          onDrop={dragging ? (e) => { e.preventDefault(); onDropAt(day.weekday, 0); } : undefined}
          className={`px-4 py-3 text-sm text-amber-600 ${dragging ? 'rounded ring-2 ring-inset ring-indigo-300' : ''}`}
        >{day.note}{dragging ? ' — drop here to add' : ''}</div>
      ) : (
        <ul>
          {day.slots.map((s, i) => (
            <Fragment key={i}>
              {dragging && <DropZone onDrop={() => onDropAt(day.weekday, i)} />}
              <li
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'slot'); onSlotDragStart(day.weekday, i); }}
                onDragEnd={onDragEnd}
                className="flex cursor-move items-center gap-2 border-b border-slate-50 pr-3 text-sm hover:bg-indigo-50/40"
              >
                <span className="pl-3 text-slate-300" title="Drag to move">⠿</span>
                <button onClick={() => onOpenEditor(day.weekday, i)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
                  {s.group && HAS_MAP.has(s.group) ? (
                    <img src={`/maps/${s.group}.svg`} alt="" className="size-7 shrink-0 object-contain" />
                  ) : (
                    <span className="size-7 shrink-0" />
                  )}
                  <span className="flex-1 font-semibold text-slate-800">{s.label}</span>
                  {s.kind === 'muscle' && <span className="shrink-0 text-[10px] font-bold uppercase text-indigo-500">musc</span>}
                  <span className="shrink-0 tabular-nums text-slate-500">{s.sets} × {s.reps}</span>
                  <span className="w-11 shrink-0 text-right text-xs tabular-nums text-slate-400">{s.rest}s</span>
                </button>
                <button
                  disabled={busy}
                  onClick={() => onRemoveSlot(day.weekday, i)}
                  className="shrink-0 text-slate-300 hover:text-rose-500 disabled:opacity-40"
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
