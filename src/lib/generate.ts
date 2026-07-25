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
const SET_WORK_SECONDS = 40;
export const slotMinutes = (sets: number, rest: number) => (sets * (SET_WORK_SECONDS + rest)) / 60;

export interface GenSlot {
  label: string; // resolved variation / muscle name
  kind: 'variation' | 'muscle';
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

function slotLabel(s: ContentSlot, catalog: Catalog): string {
  if (s.slot_kind === 'muscle') return catalog.musclesById.get(s.muscle_id ?? '')?.name ?? 'Muscle';
  return catalog.familiesByKey.get(s.family_key ?? '')?.display_name ?? s.family_key ?? '?';
}

// Apply goal shifts + fill the time budget; return surviving slots in day order.
function buildDay(day: SplitDay, recipe: ContentRecipe | undefined, goal: ContentGoal, budgetMinutes: number, catalog: Catalog): GenDay {
  const base: GenDay = { weekday: day.weekday, dayName: day.day_name, dayType: day.day_type, slots: [], dropped: 0, estMinutes: 0 };
  if (!recipe) {
    return { ...base, note: day.day_type ? `No "${day.day_type}" recipe yet` : 'No recipe assigned' };
  }
  // Goal-adjusted copy of each slot (+ its estimated minutes, rest included).
  const adjusted = recipe.slots.map((s) => {
    const sets = Math.max(1, s.base_sets + goal.set_shift);
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
  // Fill the time budget: keep by priority (then order) until the next slot would
  // overrun the session. Longer rests (strength) eat the budget faster.
  const byPriority = [...adjusted].sort((a, b) => a.src.priority - b.src.priority || a.src.sort_order - b.src.sort_order);
  const keep = new Set<ContentSlot>();
  let used = 0;
  for (const a of byPriority) {
    if (used + a.mins <= budgetMinutes) {
      keep.add(a.src);
      used += a.mins;
    } else break;
  }
  const kept = adjusted.filter((a) => keep.has(a.src)).sort((x, y) => x.src.sort_order - y.src.sort_order);
  const slots: GenSlot[] = kept.map((a) => ({
    label: slotLabel(a.src, catalog),
    kind: a.src.slot_kind,
    sets: a.sets,
    reps: Math.round((a.repLow + a.repHigh) / 2),
    rest: a.rest,
    priority: a.src.priority,
  }));
  const estMinutes = Math.round(kept.reduce((t, a) => t + a.mins, 0));
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
  return [...split.day_assignments]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => buildDay(d, d.day_type ? recipeByType.get(d.day_type) : undefined, goal, ceilingMinutes, catalog));
}

export const weekdayLabel = (w: number) => WD[w - 1] ?? '?';
