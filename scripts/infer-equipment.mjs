// Infer each catalog exercise's `equipment` from its name (phase 2 of the
// equipment feature).
//
//   node scripts/infer-equipment.mjs
//
// Reads content_exercises with the anon key and classifies every untagged row
// into one of three tiers:
//
//   keyword    — the name literally says it ("Dumbbell Curl", "Cable Fly").
//   convention — the name doesn't say it, but there's one standard answer
//                ("Bench Press" is a barbell; "Leg Press" is a machine).
//   review     — genuinely two-way; a human picks. NOT auto-applied.
//
// Writes generated/equipment-inferred.sql (keyword + convention only) and
// generated/equipment-review.tsv (the review list, with a suggestion). Nothing
// is written to the database — catalog writes require an authenticated admin,
// so apply the SQL from the dashboard's SQL editor after reading it.
//
// Re-runnable: already-tagged rows are skipped unless you pass --overwrite.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERWRITE = process.argv.includes('--overwrite');

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

// ---------------------------------------------------------------------------
// Rules. First match wins, so ORDER MATTERS: "Smith Machine Bench Press" has to
// hit the smith rule before the barbell one, and "Incline Cable Fly" has to hit
// cable before anything else.
// ---------------------------------------------------------------------------

const KEYWORD_RULES = [
  [/smith machine/i, 'machine'],
  [/\bcable\b/i, 'cable'],
  // Pushdowns and pulldowns are cable stations even when unnamed.
  [/pushdown|pulldown/i, 'cable'],
  [/\bmachine\b/i, 'machine'],
  [/dumbbell/i, 'dumbbell'],
  [/barbell|ez-bar/i, 'barbell'],
  [/kettlebell/i, 'kettlebell'],
  [/\bbanded\b|resistance band/i, 'band'],
  [/\bplate\b/i, 'plate'],
];

// The name doesn't name the equipment, but there's one conventional answer.
const CONVENTION = {
  // Barbell by default in every gym and every program that lists them.
  'Bench Press': 'barbell',
  'Incline Bench Press': 'barbell',
  'Decline Bench Press': 'barbell',
  'Close-grip Bench': 'barbell',
  'Front Squat': 'barbell',
  'Romanian Deadlift': 'barbell',
  'Stiff-Leg Deadlift': 'barbell',
  'Sumo Deadlift': 'barbell',
  'T-Bar Row': 'barbell',
  'Meadows Row': 'barbell',
  'Drag Curl': 'barbell',
  'Preacher Curl': 'barbell',
  // Dedicated stations.
  'Pec Deck': 'machine',
  'Reverse Pec Deck': 'machine',
  'Leg Press': 'machine',
  'Leg Extension': 'machine',
  'Lying Leg Curl': 'machine',
  'Seated Leg Curl': 'machine',
  'Hack Squat': 'machine',
  'Chest-Supported Row': 'machine',
  'Rowing Machine': 'machine',
  'Elliptical': 'machine',
  'Stair Climber': 'machine',
  'Leg Press Calf Raise': 'machine',
  // Cable stations by name.
  'Face Pull': 'cable',
  // Bodyweight.
  'Push-up': 'none',
  'Diamond Push-up': 'none',
  'Pull-ups': 'none',
  'Chin-ups': 'none',
  'Chest Dip': 'none',
  'Triceps Dip': 'none',
  'Bench Dips': 'none',
  'Inverted Row': 'none',
  'Superman': 'none',
  'Crunch': 'none',
  'Sit-up': 'none',
  'Bicycle Crunch': 'none',
  'Reverse Crunch': 'none',
  'Plank': 'none',
  'Side Plank': 'none',
  'Hollow Hold': 'none',
  'Hanging Leg Raise': 'none',
  'Lying Leg Raise': 'none',
  'Mountain Climbers': 'none',
  'Dead Hang': 'none',
  'Wall Sit': 'none',
  'Glute Bridge': 'none',
  'Nordic Curl': 'none',
  'Burpee': 'none',
  'Cossack Squat': 'none',
  'Heel Walks': 'none',
  // Plyometrics — bodyweight by definition. (Box/Depth Jump need a box, so
  // they're tagged 'other' below.)
  'Broad Jump': 'none',
  'Jump Squat': 'none',
  'Tuck Jump': 'none',
  'Lateral Bound': 'none',
  'Skater Hops': 'none',
  'Pogo Hops': 'none',
  'Single-leg Bound': 'none',
  'Plyo Push-up': 'none',
  'Clap Push-up': 'none',
  // Named dumbbell lift that doesn't say "dumbbell".
  'Arnold Press': 'dumbbell',
  // ---------------------------------------------------------------------
  // Reviewed and decided 2026-08-09. The rule for anything loadable-or-not:
  // if it can be done with NO equipment, tag it 'none'. 'none' is never
  // filtered, so a dumbbell owner still sees it — whereas tagging it
  // 'dumbbell' would hide it from a bodyweight user who can do it fine.
  // ---------------------------------------------------------------------
  'Concentration Curl': 'dumbbell',
  'Spider Curl': 'dumbbell',
  'Hammer Curl': 'dumbbell',
  'Zottman Curl': 'dumbbell',
  'Goblet Squat': 'dumbbell',      // not meaningful unloaded
  'Hip Thrust': 'barbell',
  'Reverse Hyperextension': 'machine',
  'Seated Calf Raise': 'machine',  // needs the station
  'Box Jump': 'other',             // needs a box
  'Depth Jump': 'other',
  'Back Extension': 'none',
  'Russian Twist': 'none',
  'Walking Lunge': 'none',
  'Step-up': 'none',
  'Bulgarian Split Squat': 'none',
  'Single-Leg RDL': 'none',
  'Standing Calf Raise': 'none',   // a step or the floor works
  'Single-Leg Calf Raise': 'none',
  'Tibialis Raise': 'none',
  // Cardio you do with no equipment.
  'Walking': 'none',
  'Running': 'none',
  'Hiking': 'none',
  'Sprints': 'none',
  'Swimming': 'none',
  'Yoga': 'none',
  'Cycling': 'other',
  'Jump Rope': 'other',
  // Implements that aren't any of the main categories.
  'Ab Wheel Rollout': 'other',
  'Wrist Roller': 'other',
  'Medicine Ball Slam': 'other',
  'Med Ball Chest Pass': 'other',
  'Rotational Med Ball Throw': 'other',
  'Foam Roll Quads': 'other',
  'Foam Roll Back': 'other',
};

// Genuinely two-way — a human decides. Value is the SUGGESTION, not a decision.
const REVIEW = {
  // Empty: every ambiguous exercise in the current catalog was reviewed and
  // moved into CONVENTION above. Kept so a newly added exercise that needs a
  // human call has somewhere to land instead of falling through as "no rule".
};

// Warm-ups and stretches are bodyweight unless the name says otherwise (the
// foam-roll ones are caught by CONVENTION above).
function classify(ex) {
  for (const [re, value] of KEYWORD_RULES) {
    if (re.test(ex.name)) return { value, tier: 'keyword', why: `name matches ${re}` };
  }
  if (REVIEW[ex.name]) {
    const [value, why] = REVIEW[ex.name];
    return { value, tier: 'review', why };
  }
  if (CONVENTION[ex.name]) return { value: CONVENTION[ex.name], tier: 'convention', why: 'standard for this lift' };
  if (ex.kind_raw === 'warmup' || ex.kind_raw === 'cooldown') {
    return { value: 'none', tier: 'convention', why: `${ex.kind_raw} — bodyweight` };
  }
  return { value: null, tier: 'review', why: 'no rule matched' };
}

// ---------------------------------------------------------------------------

const { data: exercises, error } = await supabase
  .from('content_exercises')
  .select('id,name,kind_raw,type_raw,equipment')
  .order('sort_order');
if (error) {
  console.error('Failed to read catalog:', error.message);
  process.exit(1);
}

const todo = exercises.filter((e) => OVERWRITE || !e.equipment);
const skipped = exercises.length - todo.length;

const auto = [];
const review = [];
for (const ex of todo) {
  const c = classify(ex);
  (c.tier === 'review' ? review : auto).push({ ...ex, ...c });
}

mkdirSync(`${HERE}/../generated`, { recursive: true });

const sql = [
  '-- Generated by scripts/infer-equipment.mjs — keyword + convention matches only.',
  '-- Read before running. The review list is in equipment-review.tsv.',
  '',
  ...auto.map((r) => `update public.content_exercises set equipment = '${r.value}' where id = '${r.id}';  -- ${r.name} (${r.tier})`),
  '',
].join('\n');
writeFileSync(`${HERE}/../generated/equipment-inferred.sql`, sql);

const tsv = [
  ['name', 'suggested', 'why'].join('\t'),
  ...review.map((r) => [r.name, r.value ?? '', r.why].join('\t')),
].join('\n');
writeFileSync(`${HERE}/../generated/equipment-review.tsv`, tsv);

const counts = auto.reduce((m, r) => ((m[r.value] = (m[r.value] ?? 0) + 1), m), {});
console.log(`catalog: ${exercises.length} exercises, ${skipped} already tagged (skipped)`);
console.log(`auto:    ${auto.length}  →  generated/equipment-inferred.sql`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`           ${String(v).padStart(3)}  ${k}`);
console.log(`review:  ${review.length}  →  generated/equipment-review.tsv`);
for (const r of review) console.log(`           ${r.name.padEnd(24)} ${(r.value ?? '?').padEnd(10)} ${r.why}`);
