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

const [mu, fa, ex] = await Promise.all([
  supabase.from('content_muscles').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_families').select('*').eq('enabled', true).order('sort_order'),
  supabase.from('content_exercises').select('*').eq('enabled', true).order('sort_order'),
]);
const err = mu.error || fa.error || ex.error;
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

const snapshot = { version: 1, generatedAt: null, muscles, families, exercises };
writeFileSync(APP_SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log(`✓ ${muscles.length} muscles · ${families.length} families · ${exercises.length} exercises`);
console.log(`✓ wrote ${APP_SNAPSHOT}`);
console.log('  Rebuild the app to bundle it — new users will seed from this.');
