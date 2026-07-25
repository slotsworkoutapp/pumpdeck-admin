import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSplits, useRecipes, useGoals, useCatalog, type ContentGoal, type ContentSplit } from '../../lib/content';
import { generateProgram, weekdayLabel, type GenDay } from '../../lib/generate';
import { GROUP_ORDER } from '../../lib/bodymap';

const HAS_MAP = new Set<string>(GROUP_ORDER);
// The three session lengths the app actually offers — the whole scenario grid.
const TIMES = [30, 45, 60];

// Persisted "I reviewed & like this scenario" checkmarks, keyed split|min|goal.
const REVIEW_KEY = 'pd_review_v1';
function loadReviewed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY) ?? '{}'); } catch { return {}; }
}
const scenarioId = (splitKey: string, minutes: number, goalKey: string) => `${splitKey}|${minutes}|${goalKey}`;

export default function Preview() {
  const { splits, loading: ls } = useSplits();
  const { recipes, loading: lr } = useRecipes();
  const { goals, loading: lg } = useGoals();
  const { catalog, loading: lc } = useCatalog();

  const [reviewed, setReviewed] = useState<Record<string, boolean>>(loadReviewed);
  const [active, setActive] = useState<{ splitKey: string; minutes: number; goalKey: string } | null>(null);

  useEffect(() => { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviewed)); }, [reviewed]);

  // Seed the active scenario once data lands.
  useEffect(() => {
    if (!active && splits?.length && goals?.length) {
      setActive({ splitKey: splits[0].key, minutes: 60, goalKey: goals[0].goal_key });
    }
  }, [active, splits, goals]);

  // day_type -> recipe id, for the "edit recipe" links on each day.
  const recipeIdByType = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recipes ?? []) m.set(r.day_type, r.id);
    return m;
  }, [recipes]);

  const orderedSplits = useMemo(() => [...(splits ?? [])].sort((a, b) => a.sort_order - b.sort_order), [splits]);
  const total = orderedSplits.length * TIMES.length * (goals?.length ?? 0);
  const doneCount = Object.values(reviewed).filter(Boolean).length;

  const loading = ls || lr || lg || lc;
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (!splits || !recipes || !goals || !catalog) return null;

  const split = active ? orderedSplits.find((s) => s.key === active.splitKey) : undefined;
  const goal = active ? goals.find((g) => g.goal_key === active.goalKey) : undefined;
  const program = split && goal && active ? generateProgram(split, recipes, goal, active.minutes, catalog) : [];
  const activeId = active ? scenarioId(active.splitKey, active.minutes, active.goalKey) : '';

  const toggleReviewed = (id: string) => setReviewed((r) => ({ ...r, [id]: !r[id] }));

  return (
    <div className="flex h-full min-h-screen">
      {/* ---- Scenario checklist ---- */}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-slate-900">Scenarios</h2>
            <span className="text-xs font-semibold tabular-nums text-slate-500">{doneCount} / {total}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }} />
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {orderedSplits.map((s) => (
            <SplitGroup
              key={s.key}
              split={s}
              goals={goals}
              reviewed={reviewed}
              activeId={activeId}
              onSelect={(minutes, goalKey) => setActive({ splitKey: s.key, minutes, goalKey })}
              onToggle={toggleReviewed}
            />
          ))}
        </div>
      </aside>

      {/* ---- Preview of the active scenario ---- */}
      <main className="flex-1 overflow-y-auto p-6">
        {!active || !split || !goal ? (
          <div className="text-slate-400">Pick a scenario on the left.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{split.display_name}</h1>
                <p className="text-sm text-slate-500">{goal.display_name} · {active.minutes} min — exactly what a new user gets.</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-slate-300">
                  {TIMES.map((m) => (
                    <button
                      key={m}
                      onClick={() => setActive({ ...active, minutes: m })}
                      className={`px-3 py-1.5 text-sm font-semibold ${active.minutes === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >{m}m</button>
                  ))}
                </div>
                <div className="flex overflow-hidden rounded-lg border border-slate-300">
                  {goals.map((g) => (
                    <button
                      key={g.goal_key}
                      onClick={() => setActive({ ...active, goalKey: g.goal_key })}
                      className={`px-3 py-1.5 text-sm font-semibold ${active.goalKey === g.goal_key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >{g.display_name}</button>
                  ))}
                </div>
                <button
                  onClick={() => toggleReviewed(activeId)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold ${reviewed[activeId] ? 'bg-emerald-500 text-white' : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                >{reviewed[activeId] ? '✓ Reviewed' : 'Mark reviewed'}</button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {program.map((d, i) => (
                <DayCard key={i} day={d} recipeId={d.dayType ? recipeIdByType.get(d.dayType) : undefined} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SplitGroup({
  split, goals, reviewed, activeId, onSelect, onToggle,
}: {
  split: ContentSplit;
  goals: ContentGoal[];
  reviewed: Record<string, boolean>;
  activeId: string;
  onSelect: (minutes: number, goalKey: string) => void;
  onToggle: (id: string) => void;
}) {
  const cells = TIMES.flatMap((m) => goals.map((g) => ({ minutes: m, goal: g, id: scenarioId(split.key, m, g.goal_key) })));
  const done = cells.filter((c) => reviewed[c.id]).length;
  return (
    <div className="px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-1">
        <span className="text-xs font-bold text-slate-700">{split.display_name}</span>
        <span className={`text-[10px] font-semibold tabular-nums ${done === cells.length ? 'text-emerald-600' : 'text-slate-400'}`}>{done}/{cells.length}</span>
      </div>
      <div className="space-y-1">
        {cells.map((c) => {
          const isActive = c.id === activeId;
          const isDone = !!reviewed[c.id];
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.minutes, c.goal.goal_key)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs ${isActive ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'hover:bg-slate-100'}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(c.id); }}
                className={`grid size-4 shrink-0 place-items-center rounded border ${isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'}`}
              >{isDone && <span className="text-[9px] leading-none">✓</span>}</button>
              <span className={`flex-1 ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{c.minutes}m · {c.goal.display_name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayCard({ day, recipeId }: { day: GenDay; recipeId?: string }) {
  const totalSets = day.slots.reduce((n, s) => n + s.sets, 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-bold text-slate-900">
          <span className="text-slate-400">{weekdayLabel(day.weekday)}</span> {day.dayName}
        </span>
        <div className="flex items-baseline gap-2">
          {day.slots.length > 0 && <span className="text-xs font-semibold text-slate-400">{day.slots.length} ex · {totalSets} sets · ~{day.estMinutes}m</span>}
          {recipeId && <Link to={`/recipes/${recipeId}`} className="text-xs font-semibold text-indigo-500 hover:underline">edit</Link>}
        </div>
      </div>
      {day.note ? (
        <div className="px-4 py-3 text-sm text-amber-600">{day.note}</div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {day.slots.map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
              {s.group && HAS_MAP.has(s.group) ? (
                <img src={`/maps/${s.group}.svg`} alt="" className="size-8 shrink-0 object-contain" />
              ) : (
                <span className="size-8 shrink-0" />
              )}
              <span className="flex-1 font-semibold text-slate-800">{s.label}</span>
              {s.kind === 'muscle' && <span className="text-[10px] font-bold uppercase text-indigo-500">muscle</span>}
              <span className="tabular-nums text-slate-500">{s.sets} × {s.reps}</span>
              <span className="w-12 text-right tabular-nums text-xs text-slate-400">{s.rest}s</span>
            </li>
          ))}
          {day.dropped > 0 && (
            <li className="px-4 py-1.5 text-xs text-slate-400">+{day.dropped} more trimmed to fit the time</li>
          )}
        </ul>
      )}
    </div>
  );
}
