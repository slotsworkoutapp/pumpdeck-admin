// Regenerate the app's offline snapshot FROM THE DATABASE (the dashboard-managed
// source of truth). Run this after editing content in the dashboard and before
// building/shipping the app — new users seed their library from this file.
//
//   npm run export-snapshot
//
// Reads the world-readable content_* tables with the anon key (no secrets), and
// writes pumpdeck/content-snapshot.json (the bundled resource).

import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SNAPSHOT = `${HERE}/../../pumpdeck/content-snapshot.json`;

// Load VITE_SUPABASE_* from .env.local (Node doesn't auto-load it).
const env = Object.fromEntries(
  readFileSync(`${HERE}/../.env.local`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const [mu, fa, ex, sp, rec, sl, go, lk] = await Promise.all([
  supabase.from('content_muscles').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_families').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_exercises').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_split_templates').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_day_recipes').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_day_recipe_slots').select('*').order('sort_order'),
  supabase.from('content_goal_profiles').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_locked_programs').select('*'),
]);
const err = mu.error || fa.error || ex.error || sp.error || rec.error || sl.error || go.error || lk.error;
if (err) {
  console.error('Fetch failed:', err.message);
  process.exit(1);
}

// Keep only the fields the app's snapshot loader reads (plus a few for humans).
const muscles = mu.data.map((m) => ({
  id: m.id, name: m.name, group_raw: m.group_raw, sort_order: m.sort_order,
  body_map_id: m.body_map_id, description: m.description,
}));
const families = fa.data.map((f) => ({
  key: f.key, display_name: f.display_name, muscle_group_raw: f.muscle_group_raw, sort_order: f.sort_order,
}));
const exercises = ex.data.map((e) => ({
  id: e.id, name: e.name, type_raw: e.type_raw, kind_raw: e.kind_raw,
  primary_muscle_id: e.primary_muscle_id,
  secondary_muscle_ids: e.secondary_muscle_ids ?? [],
  additional_primary_muscle_ids: e.additional_primary_muscle_ids ?? [],
  default_rest_seconds: e.default_rest_seconds,
  movement_family_key: e.movement_family_key,
  sort_order: e.sort_order,
}));

// Program-gen v2: splits, day recipes (with their slots nested), goal profiles.
const splits = sp.data.map((s) => ({
  key: s.key, display_name: s.display_name, blurb: s.blurb,
  min_days: s.min_days, max_days: s.max_days, day_assignments: s.day_assignments, sort_order: s.sort_order,
}));
const recipes = rec.data.map((r) => ({
  id: r.id, day_type: r.day_type, display_name: r.display_name, sort_order: r.sort_order,
  slots: sl.data
    .filter((s) => s.recipe_id === r.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      sort_order: s.sort_order, slot_kind: s.slot_kind, family_key: s.family_key, muscle_id: s.muscle_id,
      base_sets: s.base_sets, rep_low: s.rep_low, rep_high: s.rep_high, rest_seconds: s.rest_seconds, priority: s.priority,
    })),
}));
const goals = go.data.map((g) => ({
  goal_key: g.goal_key, display_name: g.display_name,
  rep_shift: g.rep_shift, rest_multiplier: g.rest_multiplier, set_shift: g.set_shift, sort_order: g.sort_order,
}));

// Locked programs: reviewed scenarios the app ships verbatim. Keep only what the
// app materializes from (family/muscle + sets/reps/rest) — drop display extras.
const lockedPrograms = (lk.data ?? []).map((p) => ({
  split_key: p.split_key, minutes: p.minutes, goal_key: p.goal_key,
  days: (p.days ?? []).map((d) => ({
    weekday: d.weekday,
    slots: (d.slots ?? []).map((s) => ({
      familyKey: s.familyKey ?? null, muscleId: s.muscleId ?? null,
      sets: s.sets, reps: s.reps, rest: s.rest,
    })),
  })),
}));

const snapshot = { version: 2, generatedAt: null, muscles, families, exercises, splits, recipes, goals, lockedPrograms };
writeFileSync(APP_SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log(`✓ ${muscles.length} muscles · ${families.length} families · ${exercises.length} exercises`);
console.log(`✓ ${splits.length} splits · ${recipes.length} recipes · ${goals.length} goals · ${lockedPrograms.length} locked programs`);
console.log(`✓ wrote ${APP_SNAPSHOT}`);
console.log('  Rebuild the app to bundle it — new users will seed from this.');
