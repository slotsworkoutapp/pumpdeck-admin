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

// Apply goal shifts + fill the time budget; return surviving slots in day order.
// `weeklySets` is the running per-group set count so far this week — the day
// leads with whichever muscles are furthest behind, so the WEEK stays balanced
// even when no single day can fit every muscle.
function buildDay(day: SplitDay, recipe: ContentRecipe | undefined, goal: ContentGoal, budgetMinutes: number, catalog: Catalog, familyMuscle: Map<string, string>, weeklySets: Map<string, number>, usedVariations: Set<string>): GenDay {
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
  // Balance-first fill: go in ROUNDS by muscle group — one exercise for each
  // muscle the day trains, then a second per muscle, etc. — so any session length
  // stays balanced across the day's muscles instead of over-indexing the first
  // one (a 35-min push still gets its triceps work). Groups are ordered by where
  // they first appear in the recipe; within a group, by the recipe's order.
  const bySortOrder = [...adjusted].sort((a, b) => a.src.sort_order - b.src.sort_order);
  const byGroup = new Map<string, typeof adjusted>();
  for (const a of bySortOrder) {
    const g = slotMuscle(a.src, familyMuscle); // balance per MUSCLE (calves ≠ quads ≠ glutes)
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(a);
  }
  // Within each muscle, lead with a variation NOT yet used this week — so the
  // week covers as many distinct variations as possible (flat press one day, fly
  // the next) instead of repeating the same one. Recipe order breaks ties.
  for (const list of byGroup.values()) {
    list.sort((a, b) => {
      const ua = usedVariations.has(a.src.family_key ?? '') ? 1 : 0;
      const ub = usedVariations.has(b.src.family_key ?? '') ? 1 : 0;
      return ua !== ub ? ua - ub : a.src.sort_order - b.src.sort_order;
    });
  }
  // Lead with the muscles furthest behind for the week (stable sort keeps the
  // recipe's order as the tiebreak among equally-trained groups).
  const groupList = [...byGroup.keys()].sort((a, b) => (weeklySets.get(a) ?? 0) - (weeklySets.get(b) ?? 0));
  const maxRounds = Math.max(0, ...[...byGroup.values()].map((v) => v.length));
  const sequence: typeof adjusted = [];
  for (let r = 0; r < maxRounds; r++) {
    for (const g of groupList) {
      const v = byGroup.get(g)!;
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
    } else {
      // How many sets of this exercise fit in the time that's left?
      const perSet = SET_WORK_SECONDS + a.rest;
      const remainingSec = (budgetMinutes - used) * 60 - EXERCISE_OVERHEAD_SECONDS;
      const fitSets = Math.floor(remainingSec / perSet);
      if (fitSets >= 2) {
        const useSets = Math.min(a.sets, fitSets);
        chosenSets.set(a.src, useSets);
        used += slotMinutes(useSets, a.rest);
      }
      break; // budget essentially full
    }
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
    familyKey: a.src.slot_kind === 'variation' ? a.src.family_key : null,
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
  // Carried across the week: per-MUSCLE set tally (each day leads with muscles
  // under-trained so far) and the set of variations already used (each muscle
  // leads with a variation not yet used, to maximize distinct-variation coverage).
  const weeklySets = new Map<string, number>();
  const usedVariations = new Set<string>();
  return [...split.day_assignments]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => {
      const day = buildDay(d, d.day_type ? recipeByType.get(d.day_type) : undefined, goal, ceilingMinutes, catalog, familyMuscle, weeklySets, usedVariations);
      for (const s of day.slots) {
        weeklySets.set(s.muscle, (weeklySets.get(s.muscle) ?? 0) + s.sets);
        if (s.familyKey) usedVariations.add(s.familyKey);
      }
      return day;
    });
}

export const weekdayLabel = (w: number) => WD[w - 1] ?? '?';
