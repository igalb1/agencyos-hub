import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, LogOut, RefreshCw, Plus } from 'lucide-react';

interface Membership { id: string; name: string; role: string; status: string }

export default function PendingApproval({ memberships }: { memberships: Membership[] }) {
  const { signOut, refreshOrganization } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-poll every 15s in case admin approves
  useEffect(() => {
    const t = setInterval(() => refreshOrganization(), 15000);
    return () => clearInterval(t);
  }, [refreshOrganization]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrganization();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const domain = user.email?.split('@')[1]?.toLowerCase() ?? null;

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: orgName.trim(), domain, owner_user_id: user.id } as any)
      .select('id').single();
    if (orgErr || !org) { setCreating(false); alert(orgErr?.message ?? 'Error'); return; }

    await supabase.from('organization_members').insert({
      organization_id: org.id, user_id: user.id, role: 'owner', status: 'active',
    } as any);
    await refreshOrganization();
    setCreating(false);
  };

  const pending = memberships.find(m => m.status === 'pending');

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-amber-500/15 items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">ממתין לאישור</h1>
            {pending ? (
              <p className="text-muted-foreground">
                שלחנו בקשת הצטרפות ל-<span className="font-semibold text-foreground">{pending.name}</span>.
                ברגע שהמנהל יאשר את הבקשה, תקבל גישה אוטומטית.
              </p>
            ) : (
              <p className="text-muted-foreground">החשבון שלך עדיין לא משויך לסוכנות פעילה.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} variant="outline" disabled={refreshing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              בדוק שוב
            </Button>

            {!showCreate ? (
              <Button onClick={() => setShowCreate(true)} variant="ghost" className="gap-2">
                <Plus className="w-4 h-4" /> או צור סוכנות חדשה משלך
              </Button>
            ) : (
              <div className="space-y-2 text-right">
                <input
                  type="text"
                  placeholder="שם הסוכנות"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground"
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreateOrg} disabled={creating || !orgName.trim()} className="flex-1">
                    {creating ? 'יוצר...' : 'צור סוכנות'}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCreate(false)}>ביטול</Button>
                </div>
              </div>
            )}

            <Button onClick={signOut} variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut className="w-4 h-4" /> התנתק
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
