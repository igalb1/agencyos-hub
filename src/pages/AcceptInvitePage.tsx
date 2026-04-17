import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react';

interface InviteInfo {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by_name: string | null;
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Auth form state (used when not signed in)
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setCurrentSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!token) {
      setLoadError('קישור לא תקין');
      setLoadingInvite(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('get_invitation_by_token', { _token: token });
      if (error || !data || data.length === 0) {
        setLoadError('ההזמנה לא נמצאה או שהקישור שגוי');
      } else {
        const inv = data[0] as InviteInfo;
        if (inv.accepted_at) setLoadError('הזמנה זו כבר נוצלה');
        else if (new Date(inv.expires_at) < new Date()) setLoadError('ההזמנה פגה תוקף');
        else setInvite(inv);
      }
      setLoadingInvite(false);
    })();
  }, [token]);

  const acceptAsCurrentUser = async () => {
    if (!token) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc('accept_invitation', { _token: token });
    setSubmitting(false);
    const result = data as { success: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({ title: 'שגיאה', description: result?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'הצטרפת לסוכנות!', description: invite?.organization_name });
    navigate('/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite || !token) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
        data: { full_name: fullName, invite_token: token },
      },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'נרשמת בהצלחה!',
        description: 'בדוק את האימייל שלך לאימות. לאחר האימות תצורף אוטומטית לסוכנות.',
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
      return;
    }
    // After login, accept the invite
    await acceptAsCurrentUser();
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center">
          <XCircle className="h-14 w-14 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">הזמנה לא תקפה</h1>
          <p className="text-muted-foreground mb-6">{loadError}</p>
          <Button onClick={() => navigate('/')}>חזרה לדף הבית</Button>
        </div>
      </div>
    );
  }

  const sameUser = currentSession?.user?.email?.toLowerCase() === invite.email.toLowerCase();
  const otherUser = currentSession && !sameUser;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            הוזמנת ל-<span className="text-primary">{invite.organization_name}</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {invite.invited_by_name ? `${invite.invited_by_name} הזמין/ה אותך ` : 'הוזמנת '}
            להצטרף כ-<strong>{invite.role === 'admin' ? 'מנהל/ת' : 'חבר/ת צוות'}</strong>
          </p>
          <p className="text-sm text-muted-foreground mt-1" dir="ltr">{invite.email}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {sameUser ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>אתה מחובר כ-{invite.email}</span>
              </div>
              <Button onClick={acceptAsCurrentUser} size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                הצטרף לסוכנות
              </Button>
            </>
          ) : otherUser ? (
            <div className="space-y-3">
              <p className="text-sm text-amber-400">
                אתה מחובר כעת עם אימייל אחר ({currentSession.user.email}). צא מהחשבון והתחבר עם {invite.email}.
              </p>
              <Button
                variant="outline"
                onClick={async () => { await supabase.auth.signOut(); }}
                className="w-full"
              >
                התנתק
              </Button>
            </div>
          ) : mode === 'signup' ? (
            <form onSubmit={handleSignup} className="space-y-4">
              <p className="text-sm text-muted-foreground">צור חשבון כדי להצטרף לסוכנות:</p>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input value={invite.email} disabled className="opacity-60" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>שם מלא</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>סיסמה</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} dir="ltr" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                הירשם והצטרף
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                יש לך כבר חשבון?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline">התחבר</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-sm text-muted-foreground">התחבר עם החשבון הקיים שלך:</p>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input value={invite.email} disabled className="opacity-60" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>סיסמה</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required dir="ltr" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                התחבר והצטרף
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                אין לך חשבון?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline">הירשם</button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
