import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { modules } from '../modules/registry';
import { useAuth } from '../lib/auth';
import SnapshotBadge from './SnapshotBadge';

export default function Shell() {
  const { session, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pd_nav_collapsed') === '1');
  useEffect(() => { localStorage.setItem('pd_nav_collapsed', collapsed ? '1' : '0'); }, [collapsed]);
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-900">
      <aside className={`flex ${collapsed ? 'w-14' : 'w-56'} flex-col border-r border-slate-200 bg-white transition-all`}>
        <div className={`flex items-center py-4 ${collapsed ? 'justify-center px-0' : 'gap-2 px-4'}`}>
          <img src="/logo.svg" alt="Slots" className="size-8 shrink-0 rounded-lg" />
          {!collapsed && <span className="flex-1 font-bold">Slots Admin</span>}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`text-slate-400 hover:text-slate-700 ${collapsed ? 'hidden' : ''}`}
            title="Collapse sidebar"
          >«</button>
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="mb-1 px-2 text-slate-400 hover:text-slate-700" title="Expand sidebar">»</button>
        )}
        <nav className="flex-1 px-2">
          {modules.filter((m) => !m.hidden).map((m) => (
            <NavLink
              key={m.id}
              to={`/${m.id}`}
              title={m.label}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${collapsed ? 'justify-center' : ''} ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {m.icon}
              {!collapsed && m.label}
            </NavLink>
          ))}
        </nav>
        <SnapshotBadge collapsed={collapsed} />
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
          {!collapsed && <div className="truncate">{session?.user.email}</div>}
          <button onClick={signOut} className="mt-1 font-semibold text-slate-500 hover:text-slate-900" title="Sign out">
            {collapsed ? '⎋' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
