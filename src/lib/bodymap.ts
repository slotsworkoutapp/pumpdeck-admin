// Muscle-group filter metadata for the Exercises page. The zoomed, colored group
// silhouettes live as static SVGs in /public/maps/<group>.svg (shared with the
// marketing site; derived from the MuscleMap package — see ATTRIBUTIONS.md).

export const GROUP_ORDER = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'] as const;

// Brand color per muscle group (matches the app + the /public/maps SVGs).
export const GROUP_COLORS: Record<string, string> = {
  chest: '#DC2626',
  back: '#2563EB',
  shoulders: '#7C3AED',
  legs: '#16A34A',
  core: '#CA8A04',
  biceps: '#EA580C',
  triceps: '#DB2777',
  forearms: '#0891B2',
};
