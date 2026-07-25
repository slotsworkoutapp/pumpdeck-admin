import { GROUP_ORDER } from '../lib/bodymap';

const HAS_MAP = new Set<string>(GROUP_ORDER);

// The zoomed, colored muscle-group silhouette (from /public/maps). Renders
// nothing for groups without a map (focus / other / null).
export function GroupMap({ group, className }: { group: string | null | undefined; className?: string }) {
  if (!group || !HAS_MAP.has(group)) return null;
  return <img src={`/maps/${group}.svg`} alt={group} title={group} className={className ?? 'size-6 object-contain'} />;
}
