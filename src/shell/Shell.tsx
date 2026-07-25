import { NavLink, Outlet } from 'react-router-dom';
import { modules } from '../modules/registry';
import { useAuth } from '../lib/auth';

export default function Shell() {
  const { session, signOut } = useAuth();
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-4">
          <img src="/logo.svg" alt="PumpDeck" className="size-8 rounded-lg" />
          <span className="font-bold">PumpDeck Admin</span>
        </div>
        <nav className="flex-1 px-2">
          {modules.filter((m) => !m.hidden).map((m) => (
            <NavLink
              key={m.id}
              to={`/${m.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {m.icon}
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          <div className="truncate">{session?.user.email}</div>
          <button onClick={signOut} className="mt-1 font-semibold text-slate-500 hover:text-slate-900">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
