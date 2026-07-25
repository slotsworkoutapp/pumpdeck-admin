import { BODY, type BodySide } from '../lib/bodymap';

// Renders the body silhouette (front or back) with the highlighted regions in
// currentColor and everything else a neutral grey. Highlighted parts are drawn
// last so they sit on top.
export function BodyMap({
  side,
  highlight,
  className,
}: {
  side: BodySide;
  highlight: Set<string>;
  className?: string;
}) {
  const b = BODY[side];
  const parts = [...b.parts].sort(
    (a, c) => (highlight.has(a.slug) ? 1 : 0) - (highlight.has(c.slug) ? 1 : 0)
  );
  return (
    <svg viewBox={b.viewBox} className={className} preserveAspectRatio="xMidYMid meet">
      {parts.map((part) =>
        part.paths.map((d, i) => {
          const on = highlight.has(part.slug);
          return (
            <path
              key={`${part.slug}-${i}`}
              d={d}
              fill={on ? 'currentColor' : '#e5e7eb'}
              stroke={on ? 'currentColor' : '#d1d5db'}
              strokeWidth={on ? 0 : 1}
            />
          );
        })
      )}
    </svg>
  );
}
