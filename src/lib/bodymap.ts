// Body silhouette rendering, ported from the MuscleMap package (Melih Colpan,
// MIT License) — the same art the iOS app uses. bodymap.json holds the SVG path
// strings per region for the male front/back figures.
import raw from './bodymap.json';

export type BodySide = 'front' | 'back';
interface Side {
  viewBox: string;
  parts: { slug: string; paths: string[] }[];
}
export const BODY = raw as unknown as Record<BodySide, Side>;

// Our 8 muscle GROUPS → MuscleMap region slugs, plus the view that best shows
// the group (front for chest/abs/quads/biceps/delts; back for lats/hams/tris).
export const GROUP_MAP: Record<string, { slugs: string[]; view: BodySide }> = {
  chest: { slugs: ['chest', 'upperChest', 'lowerChest'], view: 'front' },
  back: { slugs: ['upperBack', 'lowerBack', 'trapezius'], view: 'back' },
  shoulders: { slugs: ['deltoids', 'frontDeltoid'], view: 'front' },
  legs: { slugs: ['quadriceps', 'innerQuad', 'outerQuad', 'adductors', 'calves', 'tibialis', 'hamstring', 'gluteal'], view: 'front' },
  core: { slugs: ['abs', 'upperAbs', 'lowerAbs', 'obliques', 'serratus'], view: 'front' },
  biceps: { slugs: ['biceps'], view: 'front' },
  triceps: { slugs: ['triceps'], view: 'back' },
  forearms: { slugs: ['forearm'], view: 'front' },
};

export const GROUP_ORDER = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'] as const;
