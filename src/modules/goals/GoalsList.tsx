import { useNavigate } from 'react-router-dom';
import { useGoals } from '../../lib/content';

export default function GoalsList() {
  const { goals, error, loading } = useGoals();
  const nav = useNavigate();
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!goals) return null;

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Goals</h1>
        <p className="text-sm text-slate-500">How a goal restyles a recipe — rep range, rest, and volume shifts applied to every slot.</p>
      </div>
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Goal</th>
              <th className="px-4 py-2 font-semibold">Rep shift</th>
              <th className="px-4 py-2 font-semibold">Rest ×</th>
              <th className="px-4 py-2 font-semibold">Set shift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {goals.map((g) => (
              <tr key={g.id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/goals/${g.goal_key}`)}>
                <td className="px-4 py-2 font-semibold text-slate-900">{g.display_name}</td>
                <td className="px-4 py-2 tabular-nums text-slate-600">{g.rep_shift > 0 ? `+${g.rep_shift}` : g.rep_shift}</td>
                <td className="px-4 py-2 tabular-nums text-slate-600">{g.rest_multiplier}×</td>
                <td className="px-4 py-2 tabular-nums text-slate-600">{g.set_shift > 0 ? `+${g.set_shift}` : g.set_shift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
