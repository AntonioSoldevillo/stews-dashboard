import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase, usernameToEmail } from './supabase';

export type Profile = {
  id: string;
  role: string;
  fullName: string;
  storeId: string;
  storeName: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

// Only the view-only account (and the Owner) may open the dashboard
async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, store_id, stores(name)')
    .eq('id', userId)
    .single();
  if (error || !data) throw new Error('This account is not set up for the dashboard.');
  if (data.role !== 'viewer' && data.role !== 'admin') {
    throw new Error('This account is for the POS tablet. Use the dashboard account.');
  }
  const store: any = Array.isArray(data.stores) ? data.stores[0] : data.stores;
  return {
    id: data.id,
    role: data.role,
    fullName: data.full_name,
    storeId: data.store_id,
    storeName: store?.name ?? 'Store',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      if (data.session) {
        try {
          setProfile(await loadProfile(data.session.user.id));
          setSession(data.session);
        } catch {
          await supabase.auth.signOut({ scope: 'local' });
        }
      }
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) {
        setSession(null);
        setProfile(null);
      } else {
        setSession(s);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(username: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error || !data.user) throw new Error('Wrong username or password.');
    try {
      setProfile(await loadProfile(data.user.id));
      setSession(data.session);
    } catch (e) {
      await supabase.auth.signOut({ scope: 'local' });
      throw e;
    }
  }

  // "local" = log out only this phone / browser, never the POS tablet
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ loading, session, profile, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}