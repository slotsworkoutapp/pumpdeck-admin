import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  isAdmin: boolean | null; // null = still checking
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null,
  isAdmin: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((e) => console.error('getSession failed:', e))
      .finally(() => setLoading(false)); // never hang on "Loading…"
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Whenever we have a session, ask the server if this user is an admin. The
  // real security is RLS on the content_* tables; this just gates the UI.
  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Race the check against a timeout so a stalled request can never leave
        // the gate stuck on "Checking access…" forever.
        const result = await Promise.race([
          supabase.rpc('is_admin_me'),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('is_admin_me timed out')), 10000)
          ),
        ]);
        if (cancelled) return;
        const { data, error } = result;
        if (error) throw error;
        setIsAdmin(Boolean(data));
      } catch (e) {
        if (cancelled) return;
        console.error('Admin check failed:', e);
        // A rejected check usually means the stored token is expired/revoked.
        // Verify against the server; if the session is truly dead, sign out so
        // the user lands on Sign in and can re-auth instead of hanging.
        try {
          const { data: u } = await supabase.auth.getUser();
          if (!u?.user) await supabase.auth.signOut();
        } catch {
          /* getUser itself failed — fall through to not-admin */
        }
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(null);
  };

  return (
    <Ctx.Provider value={{ session, isAdmin, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
