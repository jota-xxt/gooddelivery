import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'establishment' | 'driver';
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  status: ApprovalStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  status: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [status, setStatus] = useState<ApprovalStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserMeta = async (userId: string) => {
    try {
      const [roleRes, statusRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('profiles').select('status').eq('user_id', userId).maybeSingle(),
      ]);
      return {
        role: (roleRes.data?.role as AppRole) ?? null,
        status: (statusRes.data?.status as ApprovalStatus) ?? null,
      };
    } catch (err) {
      console.error('Error fetching user meta:', err);
      return { role: null, status: null };
    }
  };

  useEffect(() => {
    let isMounted = true;
    // Track which user ID we've already fetched meta for to avoid duplicates
    let lastFetchedUserId: string | null = null;

    const handleSession = async (newSession: Session | null) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      const userId = newSession?.user?.id;
      if (userId && userId !== lastFetchedUserId) {
        lastFetchedUserId = userId;
        const meta = await fetchUserMeta(userId);
        if (!isMounted) return;
        setRole(meta.role);
        setStatus(meta.status);
      } else if (!userId) {
        lastFetchedUserId = null;
        setRole(null);
        setStatus(null);
      }

      if (isMounted) setLoading(false);
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleSession(newSession);
      }
    );

    // Then restore session — the onAuthStateChange INITIAL_SESSION event
    // will fire and be handled by the listener above.
    // As a fallback, also call getSession:
    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      // Only use this if loading is still true (listener hasn't fired yet)
      if (isMounted && loading) {
        handleSession(restoredSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setStatus(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, status, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
