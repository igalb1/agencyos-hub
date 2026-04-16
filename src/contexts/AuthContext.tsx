import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string | null; avatar_url: string | null } | null;
  organization: { id: string; name: string; logo_url: string | null; trial_ends_at: string; is_active: boolean } | null;
  loading: boolean;
  trialExpired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [organization, setOrganization] = useState<AuthContextType['organization']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchOrganization(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setOrganization(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchOrganization(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', userId)
      .single();
    if (data) setProfile(data);
  };

  const fetchOrganization = async (userId: string) => {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (membership) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, logo_url')
        .eq('id', membership.organization_id)
        .single();
      if (org) setOrganization(org);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, organization, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
