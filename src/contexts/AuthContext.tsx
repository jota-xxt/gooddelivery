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
  const [state, setState] = useState<{
    user: User | null;
    session: Session | null;
    role: AppRole | null;
    status: ApprovalStatus | null;
    loading: boolean;
  }>({ user: null, session: null, role: null, status: null, loading: true });

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
    let lastFetchedUserId: string | null = null;
    let initialized = false;

    const handleSession = async (newSession: Session | null) => {
      if (!isMounted) return;

      const userId = newSession?.user?.id;
      if (userId && userId !== lastFetchedUserId) {
        lastFetchedUserId = userId;
        const meta = await fetchUserMeta(userId);
        if (!isMounted) return;
        setState({
          user: newSession?.user ?? null,
          session: newSession,
          role: meta.role,
          status: meta.status,
          loading: false,
        });
      } else if (userId && userId === lastFetchedUserId) {
        // Same user, just update session without re-fetching
        setState(prev => ({ ...prev, session: newSession, user: newSession?.user ?? null }));
      } else {
        lastFetchedUserId = null;
        setState({ user: null, session: null, role: null, status: null, loading: false });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        initialized = true;
        handleSession(newSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      if (isMounted && !initialized) {
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
