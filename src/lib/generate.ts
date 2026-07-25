// The v2 program generator, in the dashboard, so you can preview any scenario.
// This mirrors what the app's generator will do: for each day in the split, take
// its recipe, apply the goal profile (rep/rest/volume style), and trim to the
// time budget (drop lowest-priority slots first).
import type { Catalog, ContentGoal, ContentRecipe, ContentSlot, ContentSplit, SplitDay } from './content';

export const TIME_BRACKETS = [
  { key: 'under30', label: '≤ 30 min', ceiling: 30 },
  { key: 'to45', label: '30–45 min', ceiling: 45 },
  { key: 'to60', label: '45–60 min', ceiling: 60 },
  { key: 'to75', label: '60–75 min', ceiling: 75 },
  { key: 'to90', label: '75–90 min', ceiling: 90 },
  { key: 'over90', label: '90+ min', ceiling: 105 },
];

// Estimated wall-clock for a slot, counting REST (the big driver). Each working
// set takes ~40s of effort plus its rest period. This is why strength (long
// rests) fits fewer exercises than hypertrophy in the same session.
// Estimated wall-clock per exercise. Each working set is ~45s of effort plus its
// rest; on top of that every exercise carries ~2 min of overhead — walking to
// the equipment, loading it, and warm-up sets before the working sets. Without
// that overhead an 8-exercise day reads ~20 min too short.
const SET_WORK_SECONDS = 45;
const EXERCISE_OVERHEAD_SECONDS = 60;
export const slotMinutes = (sets: number, rest: number) =>
  (EXERCISE_OVERHEAD_SECONDS + sets * (SET_WORK_SECONDS + rest)) / 60;

// Real programs use "nice" rep targets, never 11/13/14. Snap the range's
// midpoint to the closest conventional number (ties resolve to the lower one).
const REP_TARGETS = [3, 4, 5, 6, 8, 10, 12, 15, 20];
function snapReps(low: number, high: number): number {
  const mid = (low + high) / 2;
  return REP_TARGETS.reduce((best, r) => (Math.abs(r - mid) < Math.abs(best - mid) ? r : best));
}

export interface GenSlot {
  label: string; // resolved variation / muscle name
  kind: 'variation' | 'muscle';
  group: string | null; // muscle group (for the mini map)
  muscle: string; // the specific muscle it targets (the round-robin balances on this)
  familyKey: string | null; // the variation key (for week-wide variation coverage)
  sets: number;
  reps: number; // a single exact target (midpoint of the goal-adjusted range)
  rest: number;
  priority: number;
}
export interface GenDay {
  weekday: number;
  dayName: string;
  dayType: string | null;
  slots: GenSlot[];
  dropped: number; // how many recipe slots were trimmed for time
  estMinutes: number; // estimated session length of the kept slots
  note?: string; // e.g. no recipe
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Workout FLOW order for display: big compound muscles first, then shoulders,
// then arms, then core — so a Push day reads chest → shoulders → triceps, never
// ping-ponging chest/triceps/chest. Within a muscle, the recipe's order (which
// already lists compounds before isolations) breaks ties.
const GROUP_RANK: Record<string, number> = {
  chest: 0, back: 0, legs: 0,
  shoulders: 1,
  biceps: 2, triceps: 2, forearms: 2,
  core: 3,
};
const groupRank = (g: string | null): number => (g != null && g in GROUP_RANK ? GROUP_RANK[g] : 1.5);

function slotLabel(s: ContentSlot, catalog: Catalog): string {
  if (s.slot_kind === 'muscle') return catalog.musclesById.get(s.muscle_id ?? '')?.name ?? 'Muscle';
  return catalog.familiesByKey.get(s.family_key ?? '')?.display_name ?? s.family_key ?? '?';
}

function slotGroup(s: ContentSlot, catalog: Catalog): string | null {
  if (s.slot_kind === 'muscle') return catalog.musclesById.get(s.muscle_id ?? '')?.group_raw ?? null;
  return catalog.familiesByKey.get(s.family_key ?? '')?.muscle_group_raw ?? null;
}

// Each variation maps to one muscle (its exercises share a primary muscle), so
// derive family → muscle id from the catalog. The round-robin balances on THIS,
// not the coarse group — otherwise "legs" swallows calves/glutes and a Push day
// over-indexes chest presses before its flies.
function buildFamilyMuscle(catalog: Catalog): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of catalog.exercises) {
    if (e.movement_family_key && e.primary_muscle_id && !m.has(e.movement_family_key)) {
      m.set(e.movement_family_key, e.primary_muscle_id);
    }
  }
  return m;
}

function slotMuscle(s: ContentSlot, familyMuscle: Map<string, string>): string {
  if (s.slot_kind === 'muscle') return s.muscle_id ?? 'other';
  return familyMuscle.get(s.family_key ?? '') ?? s.family_key ?? 'other';
}

// Groups whose sub-muscles are trained TOGETHER (a bench hits all of the chest),
// so we balance them as ONE unit — otherwise splitting chest into upper/mid/lower
// crowds out triceps on a push day. The rest (legs, back, shoulders) are
// DIVISIBLE — a squat doesn't hit calves, a row doesn't hit rear delts — so those
// balance per muscle. Matches the group-slot eligibility.
const UNIFIED_GROUPS = new Set(['chest', 'biceps', 'triceps', 'core', 'forearms']);

// The key the round-robin balances on: the group for unified groups, the specific
// muscle for divisible ones.
function balanceKey(s: ContentSlot, catalog: Catalog, familyMuscle: Map<string, string>): string {
  const group = slotGroup(s, catalog);
  if (group && UNIFIED_GROUPS.has(group)) return group;
  return slotMuscle(s, familyMuscle);
}

// Apply goal shifts + fill the time budget; return surviving slots in day order.
// `weeklySets` is the running per-group set count so far this week — the day
// leads with whichever muscles are furthest behind, so the WEEK stays balanced
// even when no single day can fit every muscle.
function buildDay(day: SplitDay, recipe: ContentRecipe | undefined, goal: ContentGoal, budgetMinutes: number, catalog: Catalog, familyMuscle: Map<string, string>, usedVariations: Set<string>): GenDay {
  const base: GenDay = { weekday: day.weekday, dayName: day.day_name, dayType: day.day_type, slots: [], dropped: 0, estMinutes: 0 };
  if (!recipe) {
    return { ...base, note: day.day_type ? `No "${day.day_type}" recipe yet` : 'No recipe assigned' };
  }
  // Goal-adjusted copy of each slot (+ its estimated minutes, rest included).
  const adjusted = recipe.slots.map((s) => {
    const sets = Math.max(2, s.base_sets + goal.set_shift);
    const repLow = Math.max(3, s.rep_low + goal.rep_shift);
    // Round rest to a clean 15s increment and cap at 3:00 — the most rest a set
    // should ever get. (A raw multiplier gives ugly, over-long values like 288s.)
    const rest = Math.min(180, Math.round((s.rest_seconds * goal.rest_multiplier) / 15) * 15);
    return {
      src: s,
      sets,
      repLow,
      repHigh: Math.max(repLow, s.rep_high + goal.rep_shift),
      rest,
      mins: slotMinutes(sets, rest),
    };
  });
  // Round-robin fill: one exercise per balance-key (unified group or divisible
  // muscle), then a second per key, etc. — so every session stays balanced across
  // the day's muscles (a 35-min push still gets triceps; a leg day gets calves).
  // Keys are ordered by where they first appear in the recipe (compounds first),
  // so each day leads with its own important work.
  const bySortOrder = [...adjusted].sort((a, b) => a.src.sort_order - b.src.sort_order);
  const byKey = new Map<string, typeof adjusted>();
  const keyOrder: string[] = []; // recipe first-appearance order
  for (const a of bySortOrder) {
    const k = balanceKey(a.src, catalog, familyMuscle);
    if (!byKey.has(k)) { byKey.set(k, []); keyOrder.push(k); }
    byKey.get(k)!.push(a);
  }
  // Within each key: the PRIMARY lift (lowest recipe sort — the compound) always
  // leads and repeats every session; only the ACCESSORY slots rotate for
  // variation coverage (prefer a variation not yet used this week).
  for (const list of byKey.values()) {
    const minSort = Math.min(...list.map((a) => a.src.sort_order));
    list.sort((a, b) => {
      const pa = a.src.sort_order === minSort ? 0 : 1;
      const pb = b.src.sort_order === minSort ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ua = usedVariations.has(a.src.family_key ?? '') ? 1 : 0;
      const ub = usedVariations.has(b.src.family_key ?? '') ? 1 : 0;
      return ua !== ub ? ua - ub : a.src.sort_order - b.src.sort_order;
    });
  }
  const maxRounds = Math.max(0, ...[...byKey.values()].map((v) => v.length));
  const sequence: typeof adjusted = [];
  for (let r = 0; r < maxRounds; r++) {
    for (const k of keyOrder) {
      const v = byKey.get(k)!;
      if (r < v.length) sequence.push(v[r]);
    }
  }

  // Fill the time budget in that round-robin order. When the next exercise doesn't
  // fully fit, don't drop it whole — trim its SETS to fill the remaining time, so
  // the session lands close to the requested length. Longer rests eat more budget.
  const chosenSets = new Map<ContentSlot, number>();
  let used = 0;
  for (const a of sequence) {
    if (used + a.mins <= budgetMinutes) {
      chosenSets.set(a.src, a.sets);
      used += a.mins;
      continue;
    }
    // Doesn't fully fit. Trim its sets toward the time that's left, but never below
    // 2 working sets — and prefer landing slightly OVER the budget to stopping well
    // under it. (At 30 min strength, 2 exercises ≈ 25 m; a 3rd tips to ~33 m — which
    // is a better session than a near-empty day.) Include only when the resulting
    // overshoot is no bigger than the shortfall we'd otherwise leave.
    const perSet = SET_WORK_SECONDS + a.rest;
    const remainingSec = (budgetMinutes - used) * 60 - EXERCISE_OVERHEAD_SECONDS;
    const fitSets = Math.floor(remainingSec / perSet);
    const useSets = Math.min(a.sets, Math.max(2, fitSets));
    const usedWith = used + slotMinutes(useSets, a.rest);
    if (useSets >= 2 && budgetMinutes - used >= usedWith - budgetMinutes) {
      chosenSets.set(a.src, useSets);
      used = usedWith;
    }
    break; // budget essentially full
  }
  // Display in workout-flow order: big muscles → shoulders → arms → core.
  const kept = adjusted.filter((a) => chosenSets.has(a.src)).sort((x, y) => {
    const rx = groupRank(slotGroup(x.src, catalog)), ry = groupRank(slotGroup(y.src, catalog));
    return rx !== ry ? rx - ry : x.src.sort_order - y.src.sort_order;
  });
  const slots: GenSlot[] = kept.map((a) => ({
    label: slotLabel(a.src, catalog),
    kind: a.src.slot_kind,
    group: slotGroup(a.src, catalog),
    muscle: slotMuscle(a.src, familyMuscle),
    familyKey: a.src.slot_kind === 'variation' ? a.src.family_key : null, // eslint-disable-line
    sets: chosenSets.get(a.src)!,
    reps: snapReps(a.repLow, a.repHigh),
    rest: a.rest,
    priority: a.src.priority,
  }));
  const estMinutes = Math.round(kept.reduce((t, a) => t + slotMinutes(chosenSets.get(a.src)!, a.rest), 0));
  return { ...base, slots, dropped: recipe.slots.length - slots.length, estMinutes };
}

export function generateProgram(
  split: ContentSplit,
  recipes: ContentRecipe[],
  goal: ContentGoal,
  ceilingMinutes: number,
  catalog: Catalog
): GenDay[] {
  const recipeByType = new Map(recipes.map((r) => [r.day_type, r]));
  const familyMuscle = buildFamilyMuscle(catalog);
  // Carried across the week: the set of variations already used, so accessory
  // slots rotate to fresh variations (flat press one push, decline the next).
  const usedVariations = new Set<string>();
  return [...split.day_assignments]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => {
      const day = buildDay(d, d.day_type ? recipeByType.get(d.day_type) : undefined, goal, ceilingMinutes, catalog, familyMuscle, usedVariations);
      for (const s of day.slots) {
        if (s.familyKey) usedVariations.add(s.familyKey);
      }
      return day;
    });
}

export const weekdayLabel = (w: number) => WD[w - 1] ?? '?';
