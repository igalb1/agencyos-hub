import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface OrgData { id: string; name: string; logo_url: string | null; trial_ends_at: string; is_active: boolean; plan: string; payment_status?: string }

interface MembershipOrg { id: string; name: string; logo_url: string | null; role: string; status: string }

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { full_name: string | null; avatar_url: string | null; is_frozen?: boolean } | null;
  organization: OrgData | null;
  organizations: MembershipOrg[];
  pendingMemberships: MembershipOrg[];
  loading: boolean;
  trialExpired: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACTIVE_ORG_KEY = 'agencyos_active_org_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [organization, setOrganization] = useState<AuthContextType['organization']>(null);
  const [organizations, setOrganizations] = useState<MembershipOrg[]>([]);
  const [pendingMemberships, setPendingMemberships] = useState<MembershipOrg[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, is_frozen')
      .eq('user_id', userId)
      .single();
    if (data) {
      setProfile(data);
      // If user is frozen, sign them out immediately and redirect
      if (data.is_frozen) {
        await supabase.auth.signOut();
        sessionStorage.setItem('agencyos_frozen_notice', '1');
        window.location.replace('/auth');
      }
    }
  };

  const fetchOrganization = useCallback(async (userId: string) => {
    // Load all memberships (any status)
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, role, status, organizations(id, name, logo_url)')
      .eq('user_id', userId);

    const all: MembershipOrg[] = (memberships ?? [])
      .map((m: any) => m.organizations ? {
        id: m.organizations.id,
        name: m.organizations.name,
        logo_url: m.organizations.logo_url,
        role: m.role,
        status: m.status ?? 'active',
      } : null)
      .filter(Boolean) as MembershipOrg[];
    const orgs = all.filter(o => o.status === 'active');
    const pending = all.filter(o => o.status === 'pending');
    setOrganizations(orgs);
    setPendingMemberships(pending);

    if (orgs.length > 0) {
      // Determine which org to load: persisted choice if still a member, else first
      const stored = localStorage.getItem(ACTIVE_ORG_KEY);
      const activeId = stored && orgs.some(o => o.id === stored) ? stored : orgs[0].id;
      localStorage.setItem(ACTIVE_ORG_KEY, activeId);

      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, logo_url, trial_ends_at, is_active, plan, payment_status')
        .eq('id', activeId)
        .single();
      if (org) setOrganization(org as OrgData);
    } else {
      setOrganization(null);
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
    // Enforce "Remember me": if user opted out and this is a fresh browser session
    // (sessionStorage is empty after browser close), sign them out before restoring.
    const rememberMe = localStorage.getItem('agencyos_remember_me');
    const sessionAlive = sessionStorage.getItem('agencyos_session_alive');
    const shouldClearSession = rememberMe === 'false' && !sessionAlive;
    sessionStorage.setItem('agencyos_session_alive', '1');

    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      if (shouldClearSession) {
        await supabase.auth.signOut();
      }

      // 1. Restore session from storage FIRST
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchOrganization(session.user.id);
        fetchRole(session.user.id);
      }
      setLoading(false);

      // 2. Then listen for subsequent auth changes
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
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
      subscription = data.subscription;
    };

    init();

    return () => { subscription?.unsubscribe(); };
  }, [fetchOrganization]);

  const signOut = async () => {
    try {
      localStorage.removeItem(ACTIVE_ORG_KEY);
      sessionStorage.removeItem('agencyos_workspace_chosen');
      sessionStorage.removeItem('agencyos_session_alive');
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[signOut] error:', err);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setOrganization(null);
      setOrganizations([]);
      setPendingMemberships([]);
      setIsSuperAdmin(false);
      setHasAccess(null);
      // Hard redirect to clear any in-memory state and ensure a clean slate
      window.location.replace('/auth');
    }
  };

  const refreshOrganization = async () => {
    if (user) await fetchOrganization(user.id);
  };

  const switchOrganization = async (orgId: string) => {
    if (!organizations.some(o => o.id === orgId)) return;
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, logo_url, trial_ends_at, is_active, plan, payment_status')
      .eq('id', orgId)
      .single();
    if (org) setOrganization(org as OrgData);
  };

  // trialExpired = no effective access (DB-driven). Super admin always has access.
  const trialExpired = !isSuperAdmin && organization && hasAccess === false;

  return (
    <AuthContext.Provider value={{ session, user, profile, organization, organizations, pendingMemberships, loading, trialExpired: !!trialExpired, isSuperAdmin, signOut, refreshOrganization, switchOrganization }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
