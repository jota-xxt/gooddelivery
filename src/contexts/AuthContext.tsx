import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const initialized = useRef(false);

  const fetchUserMeta = async (userId: string) => {
    try {
      const [roleRes, statusRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('profiles').select('status').eq('user_id', userId).single(),
      ]);
      setRole((roleRes.data?.role as AppRole) ?? null);
      setStatus((statusRes.data?.status as ApprovalStatus) ?? null);
    } catch (err) {
      console.error('Error fetching user meta:', err);
      setRole(null);
      setStatus(null);
    }
  };

  useEffect(() => {
    // First: restore session from storage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserMeta(session.user.id);
      }
      setLoading(false);
      initialized.current = true;
    });

    // Then: listen for subsequent auth changes (sign in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Skip the initial event — already handled by getSession
        if (!initialized.current) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fire and forget — don't await inside callback
          fetchUserMeta(session.user.id);
        } else {
          setRole(null);
          setStatus(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setSession(null);
    setRole(null);
    setStatus(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, status, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
