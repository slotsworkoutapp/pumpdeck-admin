import { useNavigate, Link } from 'react-router-dom';
import { useCreatorPayouts } from '../../lib/content';

const pct = (r: number) => `${Math.round(r * 100)}%`;
const money = (n: number) => `$${n.toFixed(2)}`;

export default function CreatorsList() {
  const { rows, error, loading } = useCreatorPayouts();
  const nav = useNavigate();
  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">Failed to load: {error}</div>;
  if (!rows) return null;

  const totalSignups = rows.reduce((s, r) => s + r.signups, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid_conversions, 0);
  const totalOwed = rows.reduce((s, r) => s + r.est_owed, 0);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Creators & payouts</h1>
          <p className="text-sm text-slate-500">
            Influencers, their referral codes, and what each has driven. A code is credited when a new user enters it in onboarding.
          </p>
        </div>
        <Link to="/creators/new" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
          + New creator
        </Link>
      </div>

      {/* Totals */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Signups" value={String(totalSignups)} />
        <Stat label="Paid conversions" value={String(totalPaid)} />
        <Stat label="Est. owed" value={money(totalOwed)} accent />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          No creators yet. Add one and give them a code to share.
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Creator</th>
                <th className="px-4 py-2 font-semibold">Code</th>
                <th className="px-4 py-2 font-semibold">Rate</th>
                <th className="px-4 py-2 text-right font-semibold">Signups</th>
                <th className="px-4 py-2 text-right font-semibold">Paid</th>
                <th className="px-4 py-2 text-right font-semibold">Active</th>
                <th className="px-4 py-2 text-right font-semibold">Est. owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.creator_id} className="cursor-pointer hover:bg-slate-50" onClick={() => nav(`/creators/${r.creator_id}`)}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {r.name}
                      {!r.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">inactive</span>}
                    </div>
                    {r.email && <div className="text-xs text-slate-400">{r.email}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{r.code}</span>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{pct(r.payout_rate)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.signups}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{r.paid_conversions}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.active_subs}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">{money(r.est_owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-400">
        <strong>Est. owed</strong> is an estimate: one billing period per paying subscriber, priced from the current product list, netted at the
        Small Business (15% commission) rate, times each creator's payout rate. Use it as a guide for cutting checks, not an invoice — exact
        lifetime revenue needs per-transaction data.
      </p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
