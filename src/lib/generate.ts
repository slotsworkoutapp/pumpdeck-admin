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

// Sets a day can hold in the session (matches the app: minutes ÷ 2.5).
export const capacityFor = (ceilingMinutes: number) => Math.floor(ceilingMinutes / 2.5);

export interface GenSlot {
  label: string; // resolved variation / muscle name
  kind: 'variation' | 'muscle';
  sets: number;
  repLow: number;
  repHigh: number;
  rest: number;
  priority: number;
}
export interface GenDay {
  weekday: number;
  dayName: string;
  dayType: string | null;
  slots: GenSlot[];
  dropped: number; // how many recipe slots were trimmed for time
  note?: string; // e.g. no recipe
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function slotLabel(s: ContentSlot, catalog: Catalog): string {
  if (s.slot_kind === 'muscle') return catalog.musclesById.get(s.muscle_id ?? '')?.name ?? 'Muscle';
  return catalog.familiesByKey.get(s.family_key ?? '')?.display_name ?? s.family_key ?? '?';
}

// Apply goal shifts + trim to capacity; return surviving slots in day order.
function buildDay(day: SplitDay, recipe: ContentRecipe | undefined, goal: ContentGoal, capacity: number, catalog: Catalog): GenDay {
  const base: GenDay = { weekday: day.weekday, dayName: day.day_name, dayType: day.day_type, slots: [], dropped: 0 };
  if (!recipe) {
    return { ...base, note: day.day_type ? `No "${day.day_type}" recipe yet` : 'No recipe assigned' };
  }
  // Goal-adjusted copy of each slot.
  const adjusted = recipe.slots.map((s) => ({
    src: s,
    sets: Math.max(1, s.base_sets + goal.set_shift),
    repLow: Math.max(3, s.rep_low + goal.rep_shift),
    repHigh: Math.max(Math.max(3, s.rep_low + goal.rep_shift), s.rep_high + goal.rep_shift),
    rest: Math.round(s.rest_seconds * goal.rest_multiplier),
  }));
  // Trim: keep by priority (then order) while total sets fit; stop at first overflow.
  const byPriority = [...adjusted].sort((a, b) => a.src.priority - b.src.priority || a.src.sort_order - b.src.sort_order);
  const keep = new Set<ContentSlot>();
  let total = 0;
  for (const a of byPriority) {
    if (total + a.sets <= capacity) {
      keep.add(a.src);
      total += a.sets;
    } else break;
  }
  const slots: GenSlot[] = adjusted
    .filter((a) => keep.has(a.src))
    .sort((x, y) => x.src.sort_order - y.src.sort_order)
    .map((a) => ({
      label: slotLabel(a.src, catalog),
      kind: a.src.slot_kind,
      sets: a.sets,
      repLow: a.repLow,
      repHigh: a.repHigh,
      rest: a.rest,
      priority: a.src.priority,
    }));
  return { ...base, slots, dropped: recipe.slots.length - slots.length };
}

export function generateProgram(
  split: ContentSplit,
  recipes: ContentRecipe[],
  goal: ContentGoal,
  ceilingMinutes: number,
  catalog: Catalog
): GenDay[] {
  const recipeByType = new Map(recipes.map((r) => [r.day_type, r]));
  const capacity = capacityFor(ceilingMinutes);
  return [...split.day_assignments]
    .sort((a, b) => a.weekday - b.weekday)
    .map((d) => buildDay(d, d.day_type ? recipeByType.get(d.day_type) : undefined, goal, capacity, catalog));
}

export const weekdayLabel = (w: number) => WD[w - 1] ?? '?';
