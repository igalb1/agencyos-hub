import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Users, Building2, CreditCard, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { OrgRowComponent } from '@/components/admin/OrgRow';

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface SubRow {
  id: string;
  user_id: string;
  product_id: string;
  price_id: string;
  status: string;
  environment: string;
  current_period_end: string | null;
  paddle_subscription_id: string;
}

export default function AdminPage() {
  const { isSuperAdmin } = useAuth();
  const { lang } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState<'orgs' | 'users' | 'subs'>('orgs');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadData();
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    const [orgRes, profRes, subRes] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
    ]);
    if (orgRes.data) setOrgs(orgRes.data as OrgRow[]);
    if (subRes.data) setSubs(subRes.data as SubRow[]);

    // Fetch emails for profiles
    if (profRes.data) {
      const profilesWithEmail = await Promise.all(
        profRes.data.map(async (p) => {
          const { data } = await supabase.rpc('get_user_email', { _user_id: p.user_id });
          return { ...p, email: data || null } as ProfileRow;
        })
      );
      setProfiles(profilesWithEmail);
    }
    setLoading(false);
  };

  const updateOrg = (updated: OrgRow) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const deleteOrg = (id: string) => {
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    starter: 'bg-blue-500/15 text-blue-400',
    pro: 'bg-purple-500/15 text-purple-400',
    business: 'bg-amber-500/15 text-amber-400',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400',
    trialing: 'bg-blue-500/15 text-blue-400',
    canceled: 'bg-red-500/15 text-red-400',
    past_due: 'bg-amber-500/15 text-amber-400',
    paused: 'bg-muted text-muted-foreground',
  };

  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const filteredProfiles = profiles.filter(p => (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Shield size={20} className="text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
          <p className="text-sm text-muted-foreground">ניהול כלל המערכת</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <Building2 size={20} className="text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{orgs.length}</p>
            <p className="text-xs text-muted-foreground">ארגונים</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <Users size={20} className="text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{profiles.length}</p>
            <p className="text-xs text-muted-foreground">משתמשים</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <CreditCard size={20} className="text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{subs.filter(s => s.status === 'active').length}</p>
            <p className="text-xs text-muted-foreground">מנויים פעילים</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['orgs', 'users', 'subs'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'orgs' ? 'ארגונים' : t === 'users' ? 'משתמשים' : 'מנויים'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-full sm:w-64">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'orgs' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start p-3 font-medium text-muted-foreground">שם</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">תוכנית</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">סטטוס</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">ניסיון עד</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">נוצר</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map(org => (
                    <OrgRowComponent key={org.id} org={org} onUpdate={updateOrg} onDelete={deleteOrg} />
                  ))}
                  {filteredOrgs.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">לא נמצאו ארגונים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start p-3 font-medium text-muted-foreground">שם</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">אימייל</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map(p => (
                    <tr key={p.user_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{p.full_name || '—'}</td>
                      <td className="p-3 text-muted-foreground">{p.email || '—'}</td>
                      <td className="p-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString('he-IL')}</td>
                    </tr>
                  ))}
                  {filteredProfiles.length === 0 && (
                    <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">לא נמצאו משתמשים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'subs' && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-start p-3 font-medium text-muted-foreground">מוצר</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">סטטוס</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">סביבה</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">סיום תקופה</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{s.product_id}</td>
                      <td className="p-3">
                        <Badge className={statusColors[s.status] || 'bg-muted text-muted-foreground'}>{s.status}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{s.environment === 'sandbox' ? 'בדיקה' : 'פעיל'}</td>
                      <td className="p-3 text-muted-foreground">
                        {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('he-IL') : '—'}
                      </td>
                    </tr>
                  ))}
                  {subs.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">אין מנויים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
