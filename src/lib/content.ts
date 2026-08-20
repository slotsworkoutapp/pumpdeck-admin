// Shared types + data hooks for the content catalog. These mirror the
// content_* tables (0100). Reused by every module.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Friendly label for an exercise kind. The stored value 'cooldown' shows as
// "stretch" (lifters say stretch, not cool down).
export const kindLabel = (k: string) => (k === 'cooldown' ? 'stretch' : k === 'warmup' ? 'warm-up' : k);

// Equipment an exercise needs — exactly one per exercise. Keys must stay in
// sync with the check constraint (migration 0155) and the app's enum; only
// labels are safe to change. 'cable' is separate from 'machine' because a home
// gym often has one without the other. 'other' is never filtered by the app.
export const EQUIPMENT_OPTIONS = [
  { value: 'none', label: 'None / Bodyweight' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'plate', label: 'Plate' },
  { value: 'band', label: 'Resistance band' },
  { value: 'other', label: 'Other' },
] as const;

export const equipmentLabel = (e: string | null) =>
  EQUIPMENT_OPTIONS.find((o) => o.value === e)?.label ?? '—';

export interface ContentMuscle {
  id: string;
  name: string;
  group_raw: string;
  sort_order: number;
  body_map_id: string | null;
  description: string | null;
  color_hex: string | null;
  icon_name: string | null;
  /// Collections only: 'muscle' | 'variation'. Null = the app's default,
  /// which groups by variation.
  groups_by: string | null;
  /// Collections only: the default `trains_tagged_muscle` for exercises filed
  /// here. Null = true.
  exercises_train_muscle: boolean | null;
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
  /// A second kind this is ALSO offered as, or null. A hip-flexor stretch
  /// belongs before squats and after them; nothing else combines usefully,
  /// which is why the form offers one pairing rather than a free choice.
  also_kind_raw: string | null;
  primary_muscle_id: string | null;
  /// The exercise's collection — a `group_raw='focus'` muscle row (Mobility,
  /// Plyometrics, Conditioning). Independent of `primary_muscle_id`: a Burpee
  /// has a collection and no muscle, a Power Clean would have both.
  collection_id: string | null;
  /// False when the tagged muscles are context only (Burpee mentions quads, but
  /// nobody counts it as leg volume). Off = no volume credit, no slot membership.
  trains_tagged_muscle: boolean;
  /// Legacy single-group column. Superseded by `primary_groups_raw`, and kept
  /// in sync with its first element for clients built before the array.
  primary_group_raw: string | null;
  /// Muscle GROUPS this is filed under instead of one muscle — 'legs',
  /// 'shoulders'. For warm-ups and stretches, where naming a single head is
  /// false precision. Several is normal and honest: a doorway chest stretch is
  /// chest AND shoulders. Set INSTEAD of primary_muscle_id.
  primary_groups_raw: string[];
  secondary_muscle_ids: string[];
  additional_primary_muscle_ids: string[];
  default_rest_seconds: number;
  movement_family_key: string | null;
  /// Null = not yet tagged. The app treats null as "always show" rather than
  /// hiding it, so an untagged exercise is never lost — it just isn't filterable.
  equipment: string | null;
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
  /// Muscle groups this day trains. Derived from `muscles` on save — kept so a
  /// coarse summary (and any app build older than per-muscle assignments) still
  /// has something to read. Don't edit directly.
  groups: string[];
  /// content_muscles ids this day trains — the source of truth. Groups are too
  /// coarse for real splits: front and side delt belong to push, rear delt to
  /// pull, and no group means "two thirds of shoulders". Absent on rows written
  /// before migration 0153.
  muscles?: string[];
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
  reviewed: boolean;
}
export const lockId = (splitKey: string, minutes: number, goalKey: string) => `${splitKey}|${minutes}|${goalKey}`;

// Saved custom programs: `locks` = the days (a working copy exists), `reviewed` =
// whether it's been checked off. A row can exist (edited) but not be reviewed.
export function useLockedPrograms() {
  const [locks, setLocks] = useState<Record<string, LockedDay[]> | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('content_locked_programs').select('*');
      const m: Record<string, LockedDay[]> = {};
      const r: Record<string, boolean> = {};
      for (const row of (data ?? []) as LockedProgram[]) {
        const id = lockId(row.split_key, row.minutes, row.goal_key);
        m[id] = row.days;
        r[id] = row.reviewed;
      }
      setLocks(m);
      setReviewed(r);
    })();
  }, [tick]);
  return { locks, reviewed, reload: () => setTick((t) => t + 1) };
}

// Save a working copy (days) with an explicit reviewed flag. Editing preserves
// the current flag; the review checkmark toggles it.
export async function saveProgram(splitKey: string, minutes: number, goalKey: string, days: LockedDay[], reviewed: boolean) {
  return supabase.from('content_locked_programs').upsert({ split_key: splitKey, minutes, goal_key: goalKey, days, reviewed });
}
// Drop the custom program entirely — back to live generation.
export async function unlockProgram(splitKey: string, minutes: number, goalKey: string) {
  return supabase.from('content_locked_programs').delete().eq('split_key', splitKey).eq('minutes', minutes).eq('goal_key', goalKey);
}

// ── Creators (affiliate / referral attribution) ──────────────────────────────
// Admin-only table (0137). Maps a referral code -> the creator who owns it and
// their payout rate. New users type the code in onboarding; it lands on
// profiles.referral_source, which we later join back to creators.code.
export interface Creator {
  id: string;
  code: string;
  name: string;
  email: string | null;
  payout_rate: number; // 0.30 = 30%
  active: boolean;
  user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useCreators() {
  const [creators, setCreators] = useState<Creator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('creators').select('*').order('created_at', { ascending: false });
      if (error) setError(error.message);
      else setCreators((data ?? []) as Creator[]);
      setLoading(false);
    })();
  }, []);
  return { creators, error, loading };
}

// Per-creator payout summary from the creator_payout_summary() RPC (0139) —
// joins referral_source -> creators -> subscriptions server-side. Admin-only.
export interface CreatorPayout {
  creator_id: string;
  code: string;
  name: string;
  email: string | null;
  payout_rate: number;
  active: boolean;
  signups: number;
  paid_conversions: number;
  active_subs: number;
  est_gross: number;
  est_owed: number;
}

export function useCreatorPayouts() {
  const [rows, setRows] = useState<CreatorPayout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('creator_payout_summary');
      if (error) setError(error.message);
      else
        setRows(
          (data ?? []).map((r: Record<string, unknown>) => ({
            creator_id: String(r.creator_id),
            code: String(r.code),
            name: String(r.name),
            email: (r.email as string) ?? null,
            payout_rate: Number(r.payout_rate),
            active: Boolean(r.active),
            signups: Number(r.signups),
            paid_conversions: Number(r.paid_conversions),
            active_subs: Number(r.active_subs),
            est_gross: Number(r.est_gross),
            est_owed: Number(r.est_owed),
          }))
        );
      setLoading(false);
    })();
  }, []);
  return { rows, error, loading };
}

// ── Feedback (admin) ─────────────────────────────────────────────────────────
// admin_feedback() (0162). The table itself has no SELECT policy — this app
// runs on the anon key, so reads go through a SECURITY DEFINER function that
// re-checks is_admin server-side.
export type FeedbackStatus = 'new' | 'open' | 'done' | 'dismissed';
export type FeedbackPriority = 'high' | 'normal' | 'low';

export interface FeedbackRow {
  id: string;
  created_at: string;
  kind: 'feedback' | 'bug';
  message: string;
  app_version: string | null;
  os_version: string | null;
  device_model: string | null;
  user_id: string;
  username: string | null;
  display_name: string | null;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  admin_note: string | null;
  /// Storage path in the private `feedback-screenshots` bucket, or null. Needs
  /// a signed URL to display — the bucket is never public, because a
  /// screenshot can contain whatever was on someone's screen.
  screenshot_path: string | null;
}

/// Triage a row. Omitted fields are left alone server-side, so changing
/// priority doesn't require restating status.
export async function updateFeedback(
  id: string,
  patch: { status?: FeedbackStatus; priority?: FeedbackPriority; note?: string },
) {
  const { error } = await supabase.rpc('admin_update_feedback', {
    p_id: id,
    p_status: patch.status ?? null,
    p_priority: patch.priority ?? null,
    p_note: patch.note ?? null,
  });
  if (error) throw new Error(error.message);
}

export function useFeedback() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_feedback');
      if (error) setError(error.message);
      else setRows((data ?? []) as FeedbackRow[]);
      setLoading(false);
    })();
  }, [tick]);
  return { rows, error, loading, reload: () => setTick((t) => t + 1) };
}

// ── Moderation reports (admin) ───────────────────────────────────────────────
// admin_moderation_reports() (0140) — reports enriched with handles + the
// target's strike count. Actions use the mod_* RPCs (0091).
export interface ModerationReport {
  report_id: string;
  created_at: string;
  reason: string;
  details: string | null;
  kind: 'exercise' | 'user';
  reporter_username: string | null;
  target_user_id: string | null;
  target_username: string | null;
  target_display_name: string | null;
  target_strikes: number;
  exercise_owner_id: string | null;
  exercise_id: string | null;
}

export function useModerationReports() {
  const [rows, setRows] = useState<ModerationReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_moderation_reports');
      if (error) setError(error.message);
      else setRows((data ?? []) as ModerationReport[]);
      setLoading(false);
    })();
  }, [tick]);
  return { rows, error, loading, reload: () => setTick((t) => t + 1) };
}
