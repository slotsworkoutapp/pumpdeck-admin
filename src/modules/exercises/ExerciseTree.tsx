import { useMemo } from 'react';
import type { Catalog, ContentExercise } from '../../lib/content';

// Muscle group → Primary muscle → Variation → Exercises, mirroring the app's
// add-exercise browser so the full default structure is visible.
const GROUP_ORDER = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms', 'focus', 'other'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface FamNode { key: string; name: string; sort: number; exercises: ContentExercise[] }
interface MuscleNode { id: string; name: string; sort: number; families: FamNode[]; loose: ContentExercise[] }
interface GroupNode { key: string; label: string; count: number; muscles: MuscleNode[] }

export default function ExerciseTree({
  catalog,
  posters,
  groupFilter,
  onOpen,
  onOpenMuscle,
  onOpenVariation,
}: {
  catalog: Catalog;
  posters: Map<string, string>;
  groupFilter?: string | null;
  onOpen: (id: string) => void;
  onOpenMuscle: (id: string) => void;
  onOpenVariation: (key: string) => void;
}) {
  const groups = useMemo<GroupNode[]>(() => {
    const byName = (a: ContentExercise, b: ContentExercise) => a.name.localeCompare(b.name);

    // group -> muscleKey -> bucket
    const tree = new Map<string, Map<string, { name: string; sort: number; fams: Map<string, ContentExercise[]>; loose: ContentExercise[] }>>();
    for (const e of catalog.exercises) {
      const m = e.primary_muscle_id ? catalog.musclesById.get(e.primary_muscle_id) : undefined;
      const group = m?.group_raw ?? 'other';
      const muscleKey = m?.id ?? '_none';
      const muscleName = m?.name ?? 'No primary muscle';
      const muscleSort = m?.sort_order ?? 999;

      if (!tree.has(group)) tree.set(group, new Map());
      const groupMap = tree.get(group)!;
      if (!groupMap.has(muscleKey)) groupMap.set(muscleKey, { name: muscleName, sort: muscleSort, fams: new Map(), loose: [] });
      const bucket = groupMap.get(muscleKey)!;

      if (e.movement_family_key) {
        if (!bucket.fams.has(e.movement_family_key)) bucket.fams.set(e.movement_family_key, []);
        bucket.fams.get(e.movement_family_key)!.push(e);
      } else bucket.loose.push(e);
    }

    return GROUP_ORDER.filter((g) => tree.has(g)).map((g) => {
      const groupMap = tree.get(g)!;
      let count = 0;
      const muscles: MuscleNode[] = [...groupMap.entries()]
        .map(([id, b]) => {
          const families: FamNode[] = [...b.fams.entries()]
            .map(([key, list]) => ({
              key,
              name: catalog.familiesByKey.get(key)?.display_name ?? key,
              sort: catalog.familiesByKey.get(key)?.sort_order ?? 999,
              exercises: list.sort(byName),
            }))
            .sort((a, b) => a.sort - b.sort);
          count += b.fams.size ? [...b.fams.values()].reduce((n, l) => n + l.length, 0) : 0;
          count += b.loose.length;
          return { id, name: b.name, sort: b.sort, families, loose: b.loose.sort(byName) };
        })
        .sort((a, b) => a.sort - b.sort);
      return { key: g, label: cap(g), count, muscles };
    });
  }, [catalog]);

  const secondaryOf = (e: ContentExercise) =>
    e.secondary_muscle_ids.map((id) => catalog.musclesById.get(id)?.name).filter(Boolean).join(', ');

  return (
    <div className="space-y-4">
      {groups.filter((g) => !groupFilter || g.key === groupFilter).map((g) => (
        <div key={g.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-100 px-4 py-2">
            <span className="font-bold uppercase tracking-wide text-slate-700">{g.label}</span>
            <span className="text-xs font-semibold text-slate-400">{g.count}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {g.muscles.map((m) => (
              <div key={m.id} className="px-3 py-2">
                {m.id === '_none' ? (
                  <div className="mb-1 px-1 text-sm font-bold text-slate-900">{m.name}</div>
                ) : (
                  <button
                    onClick={() => onOpenMuscle(m.id)}
                    className="group mb-1 flex items-center gap-1.5 rounded px-1 text-sm font-bold text-slate-900 hover:text-indigo-600"
                  >
                    {m.name}
                    <EditHint />
                  </button>
                )}
                <div className="space-y-2">
                  {m.families.map((f) => (
                    <div key={f.key}>
                      <button
                        onClick={() => onOpenVariation(f.key)}
                        className="group mb-0.5 flex items-center gap-1.5 rounded px-1 hover:bg-indigo-50"
                      >
                        <VariationIcon />
                        <span className="text-xs font-bold uppercase tracking-wide text-indigo-600">{f.name}</span>
                        <span className="text-[10px] font-semibold text-slate-400">variation · {f.exercises.length}</span>
                        <EditHint />
                      </button>
                      <div className="ml-3 border-l-2 border-slate-100 pl-2">
                        {f.exercises.map((e) => (
                          <ExRow key={e.id} e={e} secondary={secondaryOf(e)} poster={posters.get(e.id)} onOpen={onOpen} />
                        ))}
                      </div>
                    </div>
                  ))}
                  {m.loose.length > 0 && (
                    <div className="ml-3 border-l-2 border-transparent pl-2">
                      {m.loose.map((e) => (
                        <ExRow key={e.id} e={e} secondary={secondaryOf(e)} onOpen={onOpen} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// A small thumbnail square: the exercise's poster if it has one, else an empty
// placeholder — so you can see at a glance which exercises still need media.
export function Thumb({ url }: { url?: string }) {
  return url ? (
    <img src={url} alt="" className="size-8 shrink-0 rounded-md border border-slate-200 object-cover" />
  ) : (
    <div className="grid size-8 shrink-0 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50">
      <svg viewBox="0 0 24 24" className="size-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="m3 16 5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ExRow({ e, secondary, poster, onOpen }: { e: ContentExercise; secondary: string; poster?: string; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(e.id)}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
    >
      <Thumb url={poster} />
      <span className="font-semibold text-slate-800">{e.name}</span>
      {e.kind_raw !== 'normal' && <span className="text-[10px] font-semibold uppercase text-slate-400">{e.kind_raw}</span>}
      {!e.enabled && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">off</span>}
      {secondary && <span className="truncate text-xs text-slate-400">· {secondary}</span>}
      <span className="ml-auto shrink-0 tabular-nums text-xs text-slate-400">{e.default_rest_seconds}s</span>
    </button>
  );
}

// A faint pencil that appears on hover, hinting the node is editable.
function EditHint() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VariationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-indigo-600" fill="currentColor">
      <path d="M12 3 3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}
