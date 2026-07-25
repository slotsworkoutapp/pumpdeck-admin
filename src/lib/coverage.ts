// Shared muscle-group coverage math, used by the Coverage table AND the
// per-scenario strip on the Program preview so they always agree.
import type { GenDay } from './generate';

export const SESSION_TIMES = [30, 45, 60];

// Groups in display order. Balance is judged by each group's FAIR SHARE of the
// split's total volume (weighted — legs/back big, arms small), not an absolute
// weekly minimum, so a small balanced split still reads green.
export const COVERAGE_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'biceps', 'triceps', 'forearms', 'core'] as const;
export const GROUP_WEIGHT: Record<string, number> = { chest: 2.5, back: 3, shoulders: 2.5, legs: 4, biceps: 1.5, triceps: 1.5, forearms: 1, core: 1.5 };
export const GROUP_SHORT: Record<string, string> = { chest: 'Chest', back: 'Back', shoulders: 'Delts', legs: 'Legs', biceps: 'Bis', triceps: 'Tris', forearms: 'Fore', core: 'Core' };
export const BALANCE_FACTOR = 0.6; // flag a group under 60% of its fair share

// Weekly sets per group actually delivered by a generated/locked program.
export function perGroupSets(days: GenDay[]): Record<string, number> {
  const p: Record<string, number> = {};
  for (const d of days) for (const s of d.slots) if (s.group) p[s.group] = (p[s.group] ?? 0) + s.sets;
  return p;
}

// A group's fair share of this program's total volume (weighted by GROUP_WEIGHT,
// over only the groups it actually trains).
export function fairShareFn(perGroup: Record<string, number>): (g: string) => number {
  const trained = COVERAGE_GROUPS.filter((g) => (perGroup[g] ?? 0) > 0);
  const total = trained.reduce((t, g) => t + perGroup[g], 0);
  const weightSum = trained.reduce((t, g) => t + GROUP_WEIGHT[g], 0);
  return (g) => (weightSum ? (total * GROUP_WEIGHT[g]) / weightSum : 0);
}

export function isLow(perGroup: Record<string, number>, g: string): boolean {
  const n = perGroup[g] ?? 0;
  return n > 0 && n < BALANCE_FACTOR * fairShareFn(perGroup)(g);
}
