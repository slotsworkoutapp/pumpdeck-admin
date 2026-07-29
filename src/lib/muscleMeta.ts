// The coaching brain of the generator. Once these 28 muscle profiles are dialed
// in, the allocator produces good programs across every frequency, length, and
// split — the algorithm is mostly mechanical; QUALITY lives here.
//
// Design (see project_muscle_primary_pivot memory + advisor thread):
//  - freq = how many times/week to INCLUDE this muscle IF space allows (a
//    frequency/desire, NOT a prescribed weekly volume). The allocator fills
//    min -> preferred -> max in tier order against the session's slot budget.
//  - tier: 5 Critical, 4 High, 3 Medium, 2 Low, 1 Specialization. Just the fill
//    order / tie-break; the freq band carries the real intelligence.
//  - kind: compound muscles go heavy + first, take the strength rep-shift, and
//    recover slower (48-72h vs 24-48h — DERIVED from kind, never stored).
//  - coverage 'indirect' + coveredBy: the muscle is trained as a side-effect of
//    its coverers. The allocator SKIPS/deprioritizes it when enough of its
//    coveredBy muscles are already on the day (Front Delt once Chest is in, etc.)
//    — this is what makes the output read like a coach wrote it.
//  - interchangeable groups (chest/triceps/biceps/core/forearms) allocate at the
//    GROUP level and only split into `heads` (in listed order) once the group
//    earns >= heads.length slots. Divisible groups (back/shoulders/legs) never
//    roll up — always the specific sub-muscle.

export type Tier = 1 | 2 | 3 | 4 | 5; // 5 Critical … 1 Specialization
export type Kind = 'compound' | 'isolation';
export type Coverage = 'direct' | 'indirect';

export interface MuscleMeta {
  key: string;
  name: string;
  group: string;              // eligibility group a split's day can allow
  interchangeable: boolean;   // true → rolls up to the group; splits into heads at >= heads.length slots
  tier: Tier;
  freq: { min: number; preferred: number; max: number };
  kind: Kind;
  coverage: Coverage;
  coveredBy: string[];        // keys whose training indirectly covers this muscle
  heads?: string[];           // ordered; interchangeable groups only
}

// One entry per ALLOCATION UNIT: each divisible muscle, and each interchangeable
// GROUP (its heads listed for the split). 14 divisible + 5 groups = all 28 muscles.
export const MUSCLE_META: MuscleMeta[] = [
  // ── Back (divisible) ───────────────────────────────────────────────
  { key: 'lats',        name: 'Lats',        group: 'back', interchangeable: false, tier: 5, freq: { min: 1, preferred: 2, max: 4 }, kind: 'compound',  coverage: 'direct',   coveredBy: [] },
  { key: 'upper_back',  name: 'Upper Back',  group: 'back', interchangeable: false, tier: 4, freq: { min: 1, preferred: 2, max: 3 }, kind: 'compound',  coverage: 'direct',   coveredBy: [] },
  { key: 'traps',       name: 'Traps',       group: 'back', interchangeable: false, tier: 3, freq: { min: 0, preferred: 1, max: 2 }, kind: 'isolation', coverage: 'indirect', coveredBy: ['upper_back', 'lats'] },
  { key: 'lower_back',  name: 'Lower Back',  group: 'back', interchangeable: false, tier: 3, freq: { min: 0, preferred: 1, max: 2 }, kind: 'compound',  coverage: 'indirect', coveredBy: ['hamstrings', 'quadriceps'] },

  // ── Shoulders (divisible) — Front is indirect, Side/Rear get the work ──
  { key: 'front_delt',  name: 'Front Delt',  group: 'shoulders', interchangeable: false, tier: 2, freq: { min: 0, preferred: 0, max: 1 }, kind: 'compound',  coverage: 'indirect', coveredBy: ['chest'] },
  { key: 'side_delt',   name: 'Side Delt',   group: 'shoulders', interchangeable: false, tier: 4, freq: { min: 0, preferred: 2, max: 4 }, kind: 'isolation', coverage: 'direct',   coveredBy: [] },
  { key: 'rear_delt',   name: 'Rear Delt',   group: 'shoulders', interchangeable: false, tier: 3, freq: { min: 0, preferred: 1, max: 3 }, kind: 'isolation', coverage: 'direct',   coveredBy: ['upper_back', 'lats'] },

  // ── Legs (divisible) ───────────────────────────────────────────────
  { key: 'quadriceps',  name: 'Quadriceps',  group: 'legs', interchangeable: false, tier: 5, freq: { min: 1, preferred: 2, max: 4 }, kind: 'compound',  coverage: 'direct',   coveredBy: [] },
  { key: 'hamstrings',  name: 'Hamstrings',  group: 'legs', interchangeable: false, tier: 5, freq: { min: 1, preferred: 2, max: 4 }, kind: 'compound',  coverage: 'direct',   coveredBy: [] },
  { key: 'glutes',      name: 'Glutes',      group: 'legs', interchangeable: false, tier: 4, freq: { min: 0, preferred: 1, max: 3 }, kind: 'compound',  coverage: 'indirect', coveredBy: ['quadriceps', 'hamstrings'] },
  { key: 'calves',      name: 'Calves',      group: 'legs', interchangeable: false, tier: 3, freq: { min: 0, preferred: 1, max: 3 }, kind: 'isolation', coverage: 'direct',   coveredBy: [] },
  { key: 'adductors',   name: 'Adductors',   group: 'legs', interchangeable: false, tier: 2, freq: { min: 0, preferred: 0, max: 1 }, kind: 'isolation', coverage: 'indirect', coveredBy: ['quadriceps', 'glutes'] },
  { key: 'abductors',   name: 'Abductors',   group: 'legs', interchangeable: false, tier: 2, freq: { min: 0, preferred: 0, max: 1 }, kind: 'isolation', coverage: 'direct',   coveredBy: [] },
  { key: 'shins',       name: 'Shins',       group: 'legs', interchangeable: false, tier: 1, freq: { min: 0, preferred: 0, max: 1 }, kind: 'isolation', coverage: 'direct',   coveredBy: [] },

  // ── Interchangeable groups (allocate at group; split into heads at >= heads.length) ──
  { key: 'chest',    name: 'Chest',    group: 'chest',    interchangeable: true, tier: 5, freq: { min: 1, preferred: 2, max: 4 }, kind: 'compound',  coverage: 'direct',   coveredBy: [],                       heads: ['mid_chest', 'upper_chest', 'lower_chest'] },
  { key: 'triceps',  name: 'Triceps',  group: 'triceps',  interchangeable: true, tier: 3, freq: { min: 0, preferred: 1, max: 3 }, kind: 'isolation', coverage: 'indirect', coveredBy: ['chest', 'front_delt'],  heads: ['triceps_long', 'triceps_lateral', 'triceps_medial'] },
  { key: 'biceps',   name: 'Biceps',   group: 'biceps',   interchangeable: true, tier: 3, freq: { min: 0, preferred: 1, max: 3 }, kind: 'isolation', coverage: 'indirect', coveredBy: ['lats', 'upper_back'],   heads: ['biceps_long', 'biceps_short'] },
  { key: 'core',     name: 'Core',     group: 'core',     interchangeable: true, tier: 3, freq: { min: 0, preferred: 1, max: 3 }, kind: 'isolation', coverage: 'direct',   coveredBy: [],                       heads: ['upper_abs', 'lower_abs', 'obliques'] },
  { key: 'forearms', name: 'Forearms', group: 'forearms', interchangeable: true, tier: 2, freq: { min: 0, preferred: 0, max: 2 }, kind: 'isolation', coverage: 'indirect', coveredBy: ['biceps', 'upper_back'], heads: ['brachioradialis', 'extensors', 'flexors'] },
];

// Head that leads when a triceps group is split but only earns 1–2 slots: the
// Long head is NOT covered by pressing (needs overhead), so it precedes the
// Lateral head; the Medial head is covered by everything, so it comes last.
// (Encoded by the order of `heads` above — the split takes them in order.)

export const muscleByKey: Record<string, MuscleMeta> = Object.fromEntries(
  MUSCLE_META.map((m) => [m.key, m])
);
