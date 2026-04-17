import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Users, Mail, Trash2, Loader2, Send, Clock, Crown, Shield, User as UserIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Member {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

const roleIcon = (role: string) => {
  if (role === 'owner') return <Crown className="h-3.5 w-3.5" />;
  if (role === 'admin') return <Shield className="h-3.5 w-3.5" />;
  return <UserIcon className="h-3.5 w-3.5" />;
};

const roleLabel = (role: string) => ({ owner: 'בעלים', admin: 'מנהל', member: 'חבר' }[role] || role);

export default function TeamSettingsCard() {
  const { user, organization } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const refresh = async () => {
    if (!organization) return;
    const [membersRes, invitesRes] = await Promise.all([
      supabase.rpc('get_org_members_with_details', { _org_id: organization.id }),
      supabase
        .from('organization_invitations')
        .select('id, email, role, expires_at, created_at, accepted_at')
        .eq('organization_id', organization.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false }),
    ]);
    if (membersRes.data) setMembers(membersRes.data as Member[]);
    if (invitesRes.data) setInvitations(invitesRes.data as Invitation[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [organization?.id]);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-invite', {
      body: { email: inviteEmail.trim(), role: inviteRole, appUrl: window.location.origin },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: 'שגיאה בשליחת ההזמנה', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'ההזמנה נשלחה!', description: `מייל נשלח אל ${inviteEmail}` });
    setInviteEmail('');
    refresh();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from('organization_invitations').delete().eq('id', id);
    if (error) { toast({ title: 'שגיאה', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'ההזמנה בוטלה' });
    refresh();
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) { toast({ title: 'שגיאה', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'החבר הוסר מהסוכנות' });
    refresh();
  };

  const changeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    if (error) { toast({ title: 'שגיאה', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'התפקיד עודכן' });
    refresh();
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Users size={20} className="text-primary" />
          <div>
            <CardTitle className="text-lg">צוות הסוכנות</CardTitle>
            <CardDescription>נהל חברי צוות והזמנות חדשות</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Invite form */}
            {canManage && (
              <form onSubmit={sendInvite} className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
                <Label className="text-sm font-medium">הזמן חבר צוות חדש</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    dir="ltr"
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">חבר</SelectItem>
                      <SelectItem value="admin">מנהל</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={sending} className="gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    שלח הזמנה
                  </Button>
                </div>
              </form>
            )}

            {/* Pending invites */}
            {invitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">הזמנות ממתינות ({invitations.length})</p>
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-4 w-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" dir="ltr">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">{roleLabel(inv.role)} · פג תוקף ב-{new Date(inv.expires_at).toLocaleDateString('he-IL')}</p>
                      </div>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Members */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">חברי הצוות ({members.length})</p>
              {members.map((m) => {
                const initials = (m.full_name || m.email).slice(0, 2).toUpperCase();
                const isMe = m.user_id === user?.id;
                const canEditThis = canManage && m.role !== 'owner' && !isMe;
                return (
                  <div key={m.member_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.full_name || m.email.split('@')[0]} {isMe && <span className="text-muted-foreground text-xs">(אתה)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEditThis ? (
                        <Select value={m.role} onValueChange={(v) => changeRole(m.member_id, v)}>
                          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">מנהל</SelectItem>
                            <SelectItem value="member">חבר</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="gap-1">{roleIcon(m.role)} {roleLabel(m.role)}</Badge>
                      )}
                      {canEditThis && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>הסר חבר צוות</AlertDialogTitle>
                              <AlertDialogDescription>
                                האם להסיר את {m.full_name || m.email} מהסוכנות? פעולה זו אינה הפיכה.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ביטול</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeMember(m.member_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                הסר
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!canManage && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                <Mail className="inline h-3 w-3 ml-1" />
                רק בעלים ומנהלים יכולים להזמין או להסיר חברי צוות
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
