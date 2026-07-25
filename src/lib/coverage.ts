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
export const GROUP_LABEL: Record<string, string> = { chest: 'Chest', back: 'Back', shoulders: 'Shoulders', legs: 'Legs', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', core: 'Core' };
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

// The balanced "target" set count for a group in this program — its fair share,
// rounded — so coverage reads as actual / target (e.g. 6 / 9).
export function groupTarget(perGroup: Record<string, number>, g: string): number {
  return Math.round(fairShareFn(perGroup)(g));
}

export type CoverageStatus = 'under' | 'on' | 'over';

// Compare actual sets to the target with a small tolerance (±20%, min ±1 set), so
// 6/6 reads "on", 6/9 reads "under", 9/6 reads "over" (too much).
export function coverageStatus(actual: number, target: number): CoverageStatus {
  if (target <= 0) return 'on';
  const tol = Math.max(1, Math.round(target * 0.2));
  if (actual < target - tol) return 'under';
  if (actual > target + tol) return 'over';
  return 'on';
}

// Tailwind classes for a coverage chip by status: red under, amber over, plain on.
export function statusChip(s: CoverageStatus): string {
  if (s === 'under') return 'bg-rose-100 text-rose-700';
  if (s === 'over') return 'bg-amber-100 text-amber-700';
  return 'text-slate-700';
}
