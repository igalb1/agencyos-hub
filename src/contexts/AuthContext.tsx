import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface OrgData { id: string; name: string; logo_url: string | null; trial_ends_at: string; is_active: boolean; plan: string; payment_status?: string }

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string | null; avatar_url: string | null } | null;
  organization: OrgData | null;
  loading: boolean;
  trialExpired: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [organization, setOrganization] = useState<AuthContextType['organization']>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('user_id', userId)
      .single();
    if (data) setProfile(data);
  };

  const fetchOrganization = useCallback(async (userId: string) => {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (membership) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, logo_url, trial_ends_at, is_active, plan, payment_status')
        .eq('id', membership.organization_id)
        .single();
      if (org) setOrganization(org as OrgData);
    }

    // Get effective access from DB
    const { data: planData } = await supabase.rpc('get_effective_plan', { _user_id: userId });
    if (planData && planData.length > 0) {
      setHasAccess(planData[0].has_access);
    }
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle();
    setIsSuperAdmin(!!data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchOrganization(session.user.id);
          fetchRole(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setOrganization(null);
        setIsSuperAdmin(false);
        setHasAccess(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchOrganization(session.user.id);
        fetchRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchOrganization]);

  // Realtime: subscription changes -> refresh org
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`org-sub-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` },
        () => fetchOrganization(user.id)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchOrganization]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setIsSuperAdmin(false);
    setHasAccess(null);
  };

  const refreshOrganization = async () => {
    if (user) await fetchOrganization(user.id);
  };

  // trialExpired = no effective access (DB-driven). Super admin always has access.
  const trialExpired = !isSuperAdmin && organization && hasAccess === false;

  return (
    <AuthContext.Provider value={{ session, user, profile, organization, loading, trialExpired: !!trialExpired, isSuperAdmin, signOut, refreshOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
