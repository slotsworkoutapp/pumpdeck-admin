import { useMemo } from 'react';
import type { ContentMuscle } from '../lib/content';
import { GroupMap } from './GroupMap';
import { GROUP_COLORS } from '../lib/bodymap';

/// Anatomical groups, in the order the app renders them.
export const GROUPS = ['chest', 'back', 'shoulders', 'legs', 'core', 'biceps', 'triceps', 'forearms'];

export type PickMuscle = { id: string; name: string; group: string; sort_order: number };

/// Every enabled muscle in anatomical order — group order first, then the
/// catalog's own order within a group. One flat list, because that's what the
/// picker scrolls through.
export function orderedMuscles(muscles: ContentMuscle[] | undefined): PickMuscle[] {
  const out: PickMuscle[] = [];
  for (const g of GROUPS) {
    const members = (muscles ?? [])
      .filter((m) => m.enabled !== false && m.group_raw === g)
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const m of members) out.push({ id: m.id, name: m.name, group: g, sort_order: m.sort_order });
  }
  return out;
}

/// `groups` is derived, never edited: the set of groups the chosen muscles
/// belong to, so a coarse consumer still sees something sane.
export function groupsForMuscles(all: PickMuscle[], ids: string[]): string[] {
  const byId = new Map(all.map((m) => [m.id, m.group]));
  const gs = new Set(ids.map((id) => byId.get(id)).filter(Boolean) as string[]);
  return GROUPS.filter((g) => gs.has(g));
}

/// Expand group names to their muscle ids — how a day written before per-muscle
/// assignments (migration 0153) is read.
export function musclesForGroups(all: PickMuscle[], groups: string[]): string[] {
  const set = new Set(groups);
  return all.filter((m) => set.has(m.group)).map((m) => m.id);
}

/// The muscles a split day trains, as one scrollable row — click to toggle.
///
/// Per muscle rather than per group, because groups can't describe a real
/// split: front and side delt belong to push while rear delt belongs to pull,
/// and no group means "two thirds of shoulders".
export function MusclePicker({
  all,
  value,
  onChange,
  disabled,
}: {
  all: PickMuscle[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const sel = useMemo(() => new Set(value), [value]);

  if (!all.length) {
    return (
      <div className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
        Loading muscles… (if this stays, the muscle catalog failed to load)
      </div>
    );
  }

  return (
    <div className={`flex gap-1 overflow-x-auto pb-1 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      {all.map((m, i) => {
        const on = sel.has(m.id);
        const color = GROUP_COLORS[m.group];
        // A hairline before each new group keeps the flat row readable.
        const newGroup = i > 0 && all[i - 1].group !== m.group;
        return (
          <div key={m.id} className="flex shrink-0 items-stretch">
            {newGroup && <span className="mr-1 w-px self-stretch bg-slate-200" />}
            <button
              onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
              title={`${m.name} · ${m.group}`}
              style={on ? { borderColor: color, backgroundColor: `${color}14`, color } : undefined}
              className={`flex w-[68px] flex-col items-center gap-1 rounded-lg border px-1 py-2 transition ${
                on ? 'font-semibold' : 'border-transparent bg-slate-50 text-slate-400 hover:text-slate-600'
              }`}
            >
              {/* No per-muscle silhouettes exist here — only the eight group
                  maps — so a muscle shows its group's map, tinted by group.
                  The map keeps its colour whether or not the muscle is
                  selected — it identifies the muscle, it isn't the selection
                  state. Selection reads from the card's border and fill. */}
              <GroupMap group={m.group} className="size-9 object-contain" />
              <span className="w-full text-center text-[9px] leading-tight">{m.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
