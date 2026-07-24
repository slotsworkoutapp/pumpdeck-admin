// One-time extractor: parse the app's hardcoded seed data (SeedData.swift +
// Exercise.swift) and emit BOTH:
//   1. a Supabase seed migration (0101_content_seed.sql) that populates the
//      content_* catalog so the DB mirrors today's app exactly, and
//   2. content-snapshot.json (the app's offline first-launch floor).
//
// IDs use RFC-4122 v5 with the same namespace as Swift's SeedID.make(name), so
// every generated id equals the id already installed on devices. Re-runnable.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v5 as uuidv5 } from 'uuid';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = `${HERE}/../../pumpdeck`;
const NAMESPACE = '9e1b7c42-1f3a-4d58-9a2e-6c0b5d8f44a1'; // == SeedID namespace
const seedId = (name) => uuidv5(name, NAMESPACE);

const seedSwift = readFileSync(`${APP}/SeedData.swift`, 'utf8');
const exSwift = readFileSync(`${APP}/Exercise.swift`, 'utf8');

// --- balanced-bracket array extractor (ignores brackets inside "strings") ---
function balancedArray(src, marker) {
  const mi = src.indexOf(marker);
  if (mi < 0) throw new Error(`marker not found: ${marker}`);
  // Anchor on the assignment '=' so we skip the type annotation's own brackets
  // (e.g. `let x: [(A, [B])] = [ ... ]`).
  const eq = src.indexOf('=', mi);
  let i = src.indexOf('[', eq);
  const start = i;
  let depth = 0, inStr = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return src.slice(start + 1, i); }
  }
  throw new Error(`unbalanced array after ${marker}`);
}

const quoted = (s) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// 1. Muscles
// ---------------------------------------------------------------------------
const muscleBlock = balancedArray(seedSwift, 'canonicalMuscleDefinitions:');
const muscles = [];
let mOrder = 0;
for (const g of muscleBlock.matchAll(/\(\.(\w+),\s*\[([\s\S]*?)\]\s*\)/g)) {
  const group = g[1];
  for (const t of g[2].matchAll(/\(\s*"([^"]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/g)) {
    muscles.push({
      id: seedId(t[1]),
      name: t[1],
      group_raw: group,
      sort_order: mOrder++,
      body_map_id: t[2] || null,
      description: t[3] || null,
      color_hex: null,
      icon_name: null,
    });
  }
}
// Focuses (Mobility, Plyometrics) — group_raw 'focus'
const focusNames = quoted(balancedArray(seedSwift, 'defaultFocusNames ='));
for (const name of focusNames) {
  muscles.push({
    id: seedId(name), name, group_raw: 'focus', sort_order: mOrder++,
    body_map_id: null, description: null, color_hex: null, icon_name: null,
  });
}
const muscleNames = new Set(muscles.map((m) => m.name));

// ---------------------------------------------------------------------------
// 2. Families (variations) + reverse name→key lookup
// ---------------------------------------------------------------------------
const label = (key) =>
  (key.split('.').pop() || key)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const familyBlock = balancedArray(exSwift, 'static let families: [String: [String]] =');
const families = [];
const familyByName = {};
let fOrder = 0;
for (const f of familyBlock.matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g)) {
  const key = f[1];
  const members = quoted(f[2]);
  families.push({
    key,
    display_name: label(key),
    muscle_group_raw: key.split('.')[0] || null,
    sort_order: fOrder++,
  });
  for (const n of members) familyByName[n] = key;
}

// ---------------------------------------------------------------------------
// 3. Exercises
// ---------------------------------------------------------------------------
const exBlock = balancedArray(seedSwift, 'static let seedExercises: [Seed] =');
const exercises = [];
let eOrder = 0;
const missingPrimary = [];
const missingSecondary = new Set();
for (const s of exBlock.matchAll(/Seed\(([\s\S]*?)\)/g)) {
  const a = s[1];
  const name = a.match(/name:\s*"([^"]+)"/)?.[1];
  if (!name) continue;
  const type = a.match(/type:\s*\.(\w+)/)?.[1] ?? 'reps';
  const primaryM = a.match(/primary:\s*(?:"([^"]+)"|nil)/);
  const primary = primaryM ? (primaryM[1] ?? null) : null;
  const secondary = quoted(a.match(/secondary:\s*\[([^\]]*)\]/)?.[1] ?? '');
  const additional = quoted(a.match(/additionalPrimary:\s*\[([^\]]*)\]/)?.[1] ?? '');
  const rest = parseInt(a.match(/rest:\s*(\d+)/)?.[1] ?? '90', 10);
  const kind = a.match(/kind:\s*\.(\w+)/)?.[1] ?? 'normal';

  if (primary && !muscleNames.has(primary)) missingPrimary.push(`${name} → ${primary}`);
  for (const n of [...secondary, ...additional]) if (!muscleNames.has(n)) missingSecondary.add(n);

  exercises.push({
    id: seedId(name),
    name,
    type_raw: type,
    kind_raw: kind,
    primary_muscle_id: primary ? seedId(primary) : null,
    secondary_muscle_ids: secondary.map(seedId),
    additional_primary_muscle_ids: additional.map(seedId),
    default_rest_seconds: rest,
    movement_family_key: familyByName[name] ?? null,
    description: null,
    notes: null,
    sort_order: eOrder++,
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
console.log(`muscles:  ${muscles.length} (incl. ${focusNames.length} focuses)`);
console.log(`families: ${families.length}`);
console.log(`exercises: ${exercises.length}`);
if (missingPrimary.length) {
  console.error(`\n⚠ ${missingPrimary.length} exercises reference an unknown PRIMARY muscle (would break FK):`);
  missingPrimary.forEach((x) => console.error('   ' + x));
}
if (missingSecondary.size) {
  console.warn(`\n⚠ secondary/additional names not in muscle set (no FK, but check): ${[...missingSecondary].join(', ')}`);
}
console.log('\nSample ids (verify against your default_exercise_media rows):');
['Bench Press', 'Barbell Back Squat', 'Pull-ups'].forEach((n) =>
  console.log(`   ${n} → ${seedId(n)}`));

// ---------------------------------------------------------------------------
// Emit SQL migration
// ---------------------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const uuidArr = (ids) => (ids.length ? `array[${ids.map((i) => `'${i}'`).join(',')}]::uuid[]` : `array[]::uuid[]`);

let sql = `-- Admin CMS — Phase 0 seed: populate content_* with today's defaults.
-- GENERATED by pumpdeck-admin/scripts/extract-seed.mjs — do not hand-edit.
-- IDs == SeedID.make(name) so materialized rows merge with installed libraries.
-- Idempotent (ON CONFLICT DO NOTHING).

`;

sql += '-- Muscles --------------------------------------------------------------\n';
for (const m of muscles) {
  sql += `insert into public.content_muscles (id,name,group_raw,sort_order,body_map_id,description,color_hex,icon_name) values (`
    + `'${m.id}',${q(m.name)},${q(m.group_raw)},${m.sort_order},${q(m.body_map_id)},${q(m.description)},${q(m.color_hex)},${q(m.icon_name)}) on conflict (id) do nothing;\n`;
}

sql += '\n-- Families (variations) ------------------------------------------------\n';
for (const f of families) {
  sql += `insert into public.content_families (key,display_name,muscle_group_raw,sort_order) values (`
    + `${q(f.key)},${q(f.display_name)},${q(f.muscle_group_raw)},${f.sort_order}) on conflict (key) do nothing;\n`;
}

sql += '\n-- Exercises ------------------------------------------------------------\n';
for (const e of exercises) {
  sql += `insert into public.content_exercises (id,name,type_raw,kind_raw,primary_muscle_id,secondary_muscle_ids,additional_primary_muscle_ids,default_rest_seconds,movement_family_key,description,notes,sort_order) values (`
    + `'${e.id}',${q(e.name)},${q(e.type_raw)},${q(e.kind_raw)},${e.primary_muscle_id ? `'${e.primary_muscle_id}'` : 'null'},`
    + `${uuidArr(e.secondary_muscle_ids)},${uuidArr(e.additional_primary_muscle_ids)},${e.default_rest_seconds},`
    + `${q(e.movement_family_key)},${q(e.description)},${q(e.notes)},${e.sort_order}) on conflict (id) do nothing;\n`;
}

const sqlPath = `${APP}/supabase/migrations/0101_content_seed.sql`;
writeFileSync(sqlPath, sql);
console.log(`\n✓ wrote ${sqlPath}`);

// ---------------------------------------------------------------------------
// Emit snapshot JSON (offline floor for the app)
// ---------------------------------------------------------------------------
const snapshot = { version: 1, generatedAt: null, muscles, families, exercises };
const snapPath = `${HERE}/../generated/content-snapshot.json`;
mkdirSync(dirname(snapPath), { recursive: true });
writeFileSync(snapPath, JSON.stringify(snapshot, null, 2));
console.log(`✓ wrote ${snapPath}`);
