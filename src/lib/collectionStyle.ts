/// The app's collection appearance options, mirrored so the dashboard offers
/// exactly what the phone can render — nothing more.
///
/// Both lists are copies of `MuscleEditSheet.focusPalette` / `.focusIcons`. If
/// you add to either there, add it here; a value the app doesn't know falls
/// back to the accent colour / default icon rather than failing.

/// Same sixteen swatches the app's collection colour picker shows.
export const COLLECTION_COLORS = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04',
  '#65A30D', '#16A34A', '#0D9488', '#0284C7',
  '#2563EB', '#7C3AED', '#9333EA', '#DB2777',
  '#475569', '#1F2937', '#A16207', '#BE123C',
];

/// SF Symbols can't render in a browser, so each one carries a plain-language
/// label and an emoji stand-in. The emoji is a visual hint for scanning the
/// list — it is NOT what the app draws.
export const COLLECTION_ICONS: { value: string; label: string; emoji: string }[] = [
  { value: 'figure.run', label: 'Run', emoji: '🏃' },
  { value: 'figure.walk', label: 'Walk', emoji: '🚶' },
  { value: 'figure.flexibility', label: 'Flexibility', emoji: '🤸' },
  { value: 'figure.cooldown', label: 'Cooldown', emoji: '🧎' },
  { value: 'figure.core.training', label: 'Core training', emoji: '🪢' },
  { value: 'figure.strengthtraining.functional', label: 'Functional strength', emoji: '🏋️' },
  { value: 'figure.jumprope', label: 'Jump rope', emoji: '🪅' },
  { value: 'figure.mind.and.body', label: 'Mind & body', emoji: '🧘' },
  { value: 'figure.yoga', label: 'Yoga', emoji: '🧎‍♀️' },
  { value: 'figure.pool.swim', label: 'Swim', emoji: '🏊' },
  { value: 'heart.fill', label: 'Heart', emoji: '❤️' },
  { value: 'bolt.fill', label: 'Bolt', emoji: '⚡' },
  { value: 'flame.fill', label: 'Flame', emoji: '🔥' },
  { value: 'wind', label: 'Wind', emoji: '💨' },
  { value: 'bed.double.fill', label: 'Rest', emoji: '🛏️' },
  { value: 'leaf.fill', label: 'Leaf', emoji: '🍃' },
  { value: 'timer', label: 'Timer', emoji: '⏲️' },
  { value: 'stopwatch.fill', label: 'Stopwatch', emoji: '⏱️' },
  { value: 'bicycle', label: 'Bicycle', emoji: '🚲' },
  { value: 'dumbbell.fill', label: 'Dumbbell', emoji: '🏋️‍♂️' },
  { value: 'star.fill', label: 'Star', emoji: '⭐' },
  { value: 'scope', label: 'Scope', emoji: '🎯' },
  { value: 'hare.fill', label: 'Hare', emoji: '🐇' },
  { value: 'tortoise.fill', label: 'Tortoise', emoji: '🐢' },
];

/// The app's default when a collection has no icon set (`Muscle.defaultFocusIcon`).
export const DEFAULT_COLLECTION_ICON = 'star.fill';

export function iconEmoji(name: string | null): string {
  return COLLECTION_ICONS.find((i) => i.value === name)?.emoji ?? '✨';
}
