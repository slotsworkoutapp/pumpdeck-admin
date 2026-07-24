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
