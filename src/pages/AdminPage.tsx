import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { Navigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Users, Building2, Search, KeyRound, Loader2 } from 'lucide-react';
import { Headset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { OrgRowComponent } from '@/components/admin/OrgRow';
import { UserRow, type AdminUser } from '@/components/admin/UserRow';

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string;
  created_at: string;
}

// AdminUser type imported from UserRow

export default function AdminPage() {
  const { isSuperAdmin } = useAuth();
  const { lang } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState<'orgs' | 'users'>('orgs');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadData();
  }, [isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    const [orgRes, usersRes] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_get_users'),
    ]);
    if (orgRes.data) setOrgs(orgRes.data as OrgRow[]);
    if (usersRes.data) setUsers(usersRes.data as unknown as AdminUser[]);
    setLoading(false);
  };

  const updateOrg = (updated: OrgRow) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const deleteOrg = (id: string) => {
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  const seedCronKey = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-cron-key', { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed');
      toast({ title: 'הצליח', description: 'מפתח הסנכרון האוטומטי הוגדר בהצלחה' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: 'שגיאה', description: msg, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const planColors: Record<string, string> = {
    free: 'bg-muted text-muted-foreground',
    starter: 'bg-blue-500/15 text-blue-400',
    pro: 'bg-purple-500/15 text-purple-400',
    business: 'bg-amber-500/15 text-amber-400',
  };

  const filteredOrgs = orgs.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter(u => (u.full_name || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase()));

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
        <Link
          to="/admin/support"
          className="ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
        >
          <Headset size={16} />
          תמיכה
        </Link>
      </div>

      {/* One-shot operator action: seed cron service role key into Vault */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <KeyRound size={20} className="text-amber-500" />
          <div>
            <p className="text-sm font-medium text-foreground">הפעלת סנכרון אוטומטי ברקע</p>
            <p className="text-xs text-muted-foreground">לחץ פעם אחת כדי להזין את מפתח השירות לכספת המאובטחת. נדרש כדי שסנכרוני Google/LinkedIn Ads ירוצו אוטומטית.</p>
          </div>
        </div>
        <Button onClick={seedCronKey} disabled={seeding} size="sm">
          {seeding ? <Loader2 size={14} className="animate-spin" /> : 'הפעל'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <p className="text-2xl font-bold text-foreground">{users.length}</p>
            <p className="text-xs text-muted-foreground">משתמשים</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['orgs', 'users'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'orgs' ? 'ארגונים' : 'משתמשים'}
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
                    <th className="text-start p-3 font-medium text-muted-foreground">סוכנויות</th>
                    <th className="text-start p-3 font-medium text-muted-foreground">נוצר</th>
                    <th className="text-end p-3 font-medium text-muted-foreground">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <UserRow key={u.user_id} user={u} onChanged={loadData} />
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">לא נמצאו משתמשים</td></tr>
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
