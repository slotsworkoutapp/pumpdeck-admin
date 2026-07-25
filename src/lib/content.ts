// Shared types + data hooks for the content catalog. These mirror the
// content_* tables (0100). Reused by every module.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Friendly label for an exercise kind. The stored value 'cooldown' shows as
// "stretch" (lifters say stretch, not cool down).
export const kindLabel = (k: string) => (k === 'cooldown' ? 'stretch' : k === 'warmup' ? 'warm-up' : k);

export interface ContentMuscle {
  id: string;
  name: string;
  group_raw: string;
  sort_order: number;
  body_map_id: string | null;
  description: string | null;
  color_hex: string | null;
  icon_name: string | null;
  enabled: boolean;
}

export interface ContentFamily {
  key: string;
  display_name: string;
  muscle_group_raw: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface ContentExercise {
  id: string;
  name: string;
  type_raw: string;
  kind_raw: string;
  primary_muscle_id: string | null;
  secondary_muscle_ids: string[];
  additional_primary_muscle_ids: string[];
  default_rest_seconds: number;
  movement_family_key: string | null;
  description: string | null;
  notes: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface Catalog {
  exercises: ContentExercise[];
  muscles: ContentMuscle[];
  families: ContentFamily[];
  musclesById: Map<string, ContentMuscle>;
  familiesByKey: Map<string, ContentFamily>;
}

// --- Goal profiles (program generation v2) ---
export interface ContentGoal {
  id: string;
  goal_key: string;
  display_name: string;
  rep_shift: number;
  rest_multiplier: number;
  set_shift: number;
  sort_order: number;
  enabled: boolean;
}

export function useGoals() {
  const [goals, setGoals] = useState<ContentGoal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('content_goal_profiles').select('*').order('sort_order');
      if (error) setError(error.message);
      else setGoals((data ?? []) as ContentGoal[]);
      setLoading(false);
    })();
  }, []);
  return { goals, error, loading };
}

// --- Split templates (program generation v2) ---
export interface SplitDay {
  weekday: number; // 1=Sun … 7=Sat
  day_name: string;
  day_type: string | null;
  groups: string[];
}
export interface ContentSplit {
  key: string;
  display_name: string;
  blurb: string | null;
  min_days: number;
  max_days: number;
  day_assignments: SplitDay[];
  sort_order: number;
  enabled: boolean;
}

export function useSplits() {
  const [splits, setSplits] = useState<ContentSplit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('content_split_templates').select('*').order('sort_order');
      if (error) setError(error.message);
      else setSplits((data ?? []) as ContentSplit[]);
      setLoading(false);
    })();
  }, []);
  return { splits, error, loading };
}

// --- Day recipes (program generation v2) ---
export interface ContentSlot {
  id?: string;
  recipe_id?: string;
  sort_order: number;
  slot_kind: 'variation' | 'muscle';
  family_key: string | null;
  muscle_id: string | null;
  base_sets: number;
  rep_low: number;
  rep_high: number;
  rest_seconds: number;
  priority: number;
}
export interface ContentRecipe {
  id: string;
  day_type: string;
  display_name: string;
  sort_order: number;
  enabled: boolean;
  slots: ContentSlot[];
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<ContentRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [rec, sl] = await Promise.all([
        supabase.from('content_day_recipes').select('*').order('sort_order'),
        supabase.from('content_day_recipe_slots').select('*').order('sort_order'),
      ]);
      const err = rec.error || sl.error;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const slotsByRecipe = new Map<string, ContentSlot[]>();
      for (const s of (sl.data ?? []) as ContentSlot[]) {
        if (!slotsByRecipe.has(s.recipe_id!)) slotsByRecipe.set(s.recipe_id!, []);
        slotsByRecipe.get(s.recipe_id!)!.push(s);
      }
      setRecipes(
        ((rec.data ?? []) as Omit<ContentRecipe, 'slots'>[]).map((r) => ({
          ...r,
          slots: (slotsByRecipe.get(r.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
        }))
      );
      setLoading(false);
    })();
  }, [tick]);

  return { recipes, error, loading, reload: () => setTick((t) => t + 1) };
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ex, mu, fa] = await Promise.all([
        supabase.from('content_exercises').select('*').order('sort_order'),
        supabase.from('content_muscles').select('*').order('sort_order'),
        supabase.from('content_families').select('*').order('sort_order'),
      ]);
      const firstErr = ex.error || mu.error || fa.error;
      if (firstErr) {
        setError(firstErr.message);
        setLoading(false);
        return;
      }
      const muscles = (mu.data ?? []) as ContentMuscle[];
      const families = (fa.data ?? []) as ContentFamily[];
      setCatalog({
        exercises: (ex.data ?? []) as ContentExercise[],
        muscles,
        families,
        musclesById: new Map(muscles.map((m) => [m.id, m])),
        familiesByKey: new Map(families.map((f) => [f.key, f])),
      });
      setLoading(false);
    })();
  }, []);

  return { catalog, error, loading };
}

// --- Locked programs (reviewed scenarios frozen as the app's source of truth) ---
export interface LockedSlot {
  familyKey: string | null;
  muscleId: string | null;
  sets: number;
  reps: number;
  rest: number;
  // Display extras (dashboard-only; the app-facing export strips these).
  muscle?: string;
  label?: string;
  group?: string | null;
  kind?: string;
  slotId?: string | null;
}
export interface LockedDay {
  weekday: number;
  dayName: string;
  dayType: string | null;
  slots: LockedSlot[];
}
export interface LockedProgram {
  split_key: string;
  minutes: number;
  goal_key: string;
  days: LockedDay[];
}
export const lockId = (splitKey: string, minutes: number, goalKey: string) => `${splitKey}|${minutes}|${goalKey}`;

// All locks, keyed split|minutes|goal → frozen days. reload() re-fetches.
export function useLockedPrograms() {
  const [locks, setLocks] = useState<Record<string, LockedDay[]> | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('content_locked_programs').select('*');
      const m: Record<string, LockedDay[]> = {};
      for (const r of (data ?? []) as LockedProgram[]) m[lockId(r.split_key, r.minutes, r.goal_key)] = r.days;
      setLocks(m);
    })();
  }, [tick]);
  return { locks, reload: () => setTick((t) => t + 1) };
}

export async function lockProgram(splitKey: string, minutes: number, goalKey: string, days: LockedDay[]) {
  return supabase.from('content_locked_programs').upsert({ split_key: splitKey, minutes, goal_key: goalKey, days });
}
export async function unlockProgram(splitKey: string, minutes: number, goalKey: string) {
  return supabase.from('content_locked_programs').delete().eq('split_key', splitKey).eq('minutes', minutes).eq('goal_key', goalKey);
}
