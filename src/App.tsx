import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { modules } from './modules/registry';
import Shell from './shell/Shell';
import SignIn from './shell/SignIn';

function Gate() {
  const { session, isAdmin, loading } = useAuth();

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
  if (!session) return <SignIn />;
  if (isAdmin === null) return <div className="grid min-h-screen place-items-center text-slate-400">Checking access…</div>;
  if (!isAdmin) return <SignIn notAdmin />;

  const first = modules[0];
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<Navigate to={`/${first.id}`} replace />} />
        {modules.map((m) => (
          <Route key={m.id} path={`/${m.id}`}>
            {m.routes.map((r, i) =>
              r.path ? (
                <Route key={i} path={r.path} element={r.element} />
              ) : (
                <Route key={i} index element={r.element} />
              )
            )}
          </Route>
        ))}
        <Route path="*" element={<Navigate to={`/${first.id}`} replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
