// Shared types + data hooks for the content catalog. These mirror the
// content_* tables (0100). Reused by every module.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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
  }, []);

  return { recipes, error, loading };
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
