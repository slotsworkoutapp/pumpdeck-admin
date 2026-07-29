// Data-driven program allocator (v1). Runs purely on muscle metadata (tier,
// frequency band, kind, coverage) + the split's per-day eligibility — no
// hardcoded recipes. Fills each day's slot budget in balanced rounds, picking
// the best-fit muscle each time, then rolls interchangeable groups up to the
// group when they earn fewer slots than they have heads.
import type { Catalog, ContentGoal, ContentRecipe, ContentSplit, SplitDay } from './content';
import type { GenDay, GenSlot } from './generate';

const INTERCHANGEABLE: Record<string, number> = { chest: 3, triceps: 3, biceps: 2, core: 3, forearms: 3 };
const REP_TARGETS = [3, 4, 5, 6, 8, 10, 12, 15, 20];
const snapReps = (low: number, high: number) => {
  const mid = (low + high) / 2;
  return REP_TARGETS.reduce((b, r) => (Math.abs(r - mid) < Math.abs(b - mid) ? r : b));
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lt = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

// Groups a day allows: the split's own per-day `groups` if present, else the
// groups its recipe touches (so splits without eligibility data still work).
function allowedGroups(day: SplitDay, recipes: ContentRecipe[], catalog: Catalog): Set<string> {
  if (day.groups && day.groups.length) return new Set(day.groups);
  const g = new Set<string>();
  const r = recipes.find((x) => x.day_type === day.day_type);
  for (const s of r?.slots ?? []) {
    if (s.slot_kind === 'muscle') {
      const m = catalog.musclesById.get(s.muscle_id ?? '');
      if (m) g.add(m.group_raw);
    } else {
      const f = catalog.familiesByKey.get(s.family_key ?? '');
      if (f?.muscle_group_raw) g.add(f.muscle_group_raw);
    }
  }
  return g;
}

export function allocateProgram(
  split: ContentSplit,
  recipes: ContentRecipe[],
  goal: ContentGoal,
  minutes: number,
  catalog: Catalog
): GenDay[] {
  const budget = Math.max(1, Math.round(minutes / 7.5)); // ~1 exercise / 7.5 min
  const pool = catalog.muscles.filter((m) => m.gen_tier != null && m.enabled && m.group_raw !== 'focus');

  const dayList = [...split.day_assignments].sort((a, b) => a.weekday - b.weekday);
  const days = dayList.map((da) => ({ da, allowed: allowedGroups(da, recipes, catalog), picks: [] as typeof pool }));
  const assigned = new Map<string, number>(pool.map((m) => [m.id, 0]));

  // Fill in balanced rounds: give each day its 1st slot, then its 2nd, … Each
  // pick is the best-fit eligible muscle for that day.
  for (let round = 0; round < budget; round++) {
    for (const day of days) {
      if (day.picks.length >= budget) continue;
      const groupsOnDay = new Set(day.picks.map((m) => m.group_raw));
      const namesOnDay = new Set(day.picks.map((m) => m.name));
      const idsOnDay = new Set(day.picks.map((m) => m.id));
      let best: (typeof pool)[number] | null = null;
      let bestScore: number[] | null = null;
      for (const m of pool) {
        if (!day.allowed.has(m.group_raw)) continue; // eligible on this day
        if (idsOnDay.has(m.id)) continue; // no repeat within a day
        if ((assigned.get(m.id) ?? 0) >= m.gen_freq_max) continue; // weekly cap
        // Fully-covered muscle (indirect + never-preferred) → skip if a coverer is already here.
        if (m.gen_coverage === 'indirect' && m.gen_freq_pref === 0 && m.gen_covered_by.some((c) => namesOnDay.has(c))) continue;
        const a = assigned.get(m.id) ?? 0;
        // Spread interchangeable groups across the day (2 chest reads redundant);
        // a 2nd divisible muscle (quad+ham) is a distinct pattern, not a repeat.
        const groupPenalty = INTERCHANGEABLE[m.group_raw] && groupsOnDay.has(m.group_raw) ? 1 : 0;
        const belowMin = a < m.gen_freq_min ? 0 : 1;
        const score = [groupPenalty, -(m.gen_tier ?? 0), belowMin, a, m.sort_order];
        if (!best || lt(score, bestScore!)) {
          best = m;
          bestScore = score;
        }
      }
      if (best) {
        day.picks.push(best);
        assigned.set(best.id, (assigned.get(best.id) ?? 0) + 1);
      }
    }
  }

  // Display roll-up: an interchangeable group with fewer weekly slots than it has
  // heads shows as the group ("Chest"); at head-count or more, the specific head.
  const weekly = new Map<string, number>();
  for (const d of days) for (const m of d.picks) if (INTERCHANGEABLE[m.group_raw]) weekly.set(m.group_raw, (weekly.get(m.group_raw) ?? 0) + 1);

  const sets = Math.max(2, 3 + (goal.set_shift ?? 0));
  const restMul = goal.rest_multiplier ?? 1;
  const repShift = goal.rep_shift ?? 0;

  return days.map((d) => {
    const slots: GenSlot[] = d.picks.map((m) => {
      const rolled = !!INTERCHANGEABLE[m.group_raw] && (weekly.get(m.group_raw) ?? 0) < INTERCHANGEABLE[m.group_raw];
      const compound = m.gen_kind === 'compound';
      // Base rep range by kind; the strength rep-shift hits COMPOUNDS only —
      // isolation stays ~10–15 regardless of goal.
      const [lo, hi] = compound ? [6, 10] : [10, 15];
      const shift = compound ? repShift : 0;
      const reps = snapReps(Math.max(3, lo + shift), Math.max(3, hi + shift));
      const rest = Math.min(180, Math.round(((compound ? 120 : 75) * restMul) / 15) * 15);
      return {
        label: rolled ? cap(m.group_raw) : m.name,
        kind: 'muscle',
        group: m.group_raw,
        muscle: m.id,
        familyKey: null,
        slotId: null,
        sets,
        reps,
        rest,
        priority: m.gen_tier ?? 0,
      };
    });
    const estMinutes = Math.round(slots.reduce((t, s) => t + (60 + s.sets * (45 + s.rest)) / 60, 0));
    return { weekday: d.da.weekday, dayName: d.da.day_name, dayType: d.da.day_type, slots, dropped: 0, estMinutes };
  });
}
