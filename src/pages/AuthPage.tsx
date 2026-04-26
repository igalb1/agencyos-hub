import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2, Mail } from 'lucide-react';
import { isPublicEmailDomain, getEmailDomain } from '@/lib/email-domain';

type Mode = 'login' | 'signup' | 'reset';
const REMEMBER_ME_KEY = 'agencyos_remember_me';
const AUTH_REDIRECT_ORIGIN = 'https://login.agencyos.solutions';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [signupChoice, setSignupChoice] = useState<'create' | 'join'>('create');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('agencyos_frozen_notice') === '1') {
      sessionStorage.removeItem('agencyos_frozen_notice');
      toast({
        title: 'החשבון שלך הוקפא',
        description: 'צור קשר עם התמיכה לקבלת מידע נוסף.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const domain = useMemo(() => getEmailDomain(email), [email]);
  const isPublic = useMemo(() => isPublicEmailDomain(email), [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false');
    navigate('/dashboard');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return toast({ title: 'שגיאה', description: 'הזן אימייל תקין', variant: 'destructive' });

    // Decide what metadata to send to the signup trigger
    let metaOrgName: string | undefined = undefined;
    if (isPublic) {
      // Public domain: must create their own agency (cannot auto-join)
      if (!orgName.trim()) {
        return toast({ title: 'שגיאה', description: 'נא להזין שם לסוכנות חדשה', variant: 'destructive' });
      }
      metaOrgName = orgName.trim();
    } else {
      // Business domain: choice — create or auto-join
      if (signupChoice === 'create') {
        if (!orgName.trim()) {
          return toast({ title: 'שגיאה', description: 'נא להזין שם לסוכנות', variant: 'destructive' });
        }
        metaOrgName = orgName.trim();
      }
      // signupChoice === 'join' → no org_name → trigger will try to attach pending
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, org_name: metaOrgName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (authError) return toast({ title: 'שגיאה', description: authError.message, variant: 'destructive' });

    toast({
      title: 'נרשמת בהצלחה!',
      description: isPublic || signupChoice === 'create'
        ? 'בדוק את האימייל שלך לאימות החשבון.'
        : 'בקשת הצטרפות נשלחה. תקבל גישה לאחר אישור המנהל. בדוק את האימייל לאימות.',
    });
    setMode('login');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${AUTH_REDIRECT_ORIGIN}/reset-password`,
    });
    setLoading(false);
    if (error) return toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    toast({ title: 'נשלח!', description: 'בדוק את האימייל שלך לאיפוס הסיסמה.' });
    setMode('login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Agency</span><span className="text-foreground">OS</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === 'login' && 'התחבר לחשבון שלך'}
            {mode === 'signup' && 'צור חשבון חדש'}
            {mode === 'reset' && 'איפוס סיסמה'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">שם מלא</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ישראל ישראלי" required />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required dir="ltr" />
            </div>

            {/* Domain detection panel — only on signup */}
            {mode === 'signup' && domain && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3">
                {isPublic ? (
                  <>
                    <div className="flex items-start gap-2 text-sm">
                      <Mail className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="text-foreground">
                        זיהינו אימייל אישי (<span dir="ltr" className="font-mono text-xs">{domain}</span>).
                        <br />
                        <span className="text-muted-foreground">צור סוכנות חדשה, או בקש קישור הזמנה ממנהל קיים.</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orgName">שם הסוכנות החדשה</Label>
                      <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="הסוכנות שלי" required />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="text-foreground">
                        אימייל עסקי בדומיין <span dir="ltr" className="font-mono text-xs">{domain}</span>.
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupChoice('join')}
                        className={`p-2 rounded-md border text-xs text-right ${signupChoice === 'join' ? 'border-primary bg-primary/10' : 'border-border'}`}
                      >
                        <div className="font-semibold">בקש להצטרף</div>
                        <div className="text-muted-foreground">לסוכנות הקיימת בדומיין שלך</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupChoice('create')}
                        className={`p-2 rounded-md border text-xs text-right ${signupChoice === 'create' ? 'border-primary bg-primary/10' : 'border-border'}`}
                      >
                        <div className="font-semibold">צור סוכנות חדשה</div>
                        <div className="text-muted-foreground">תהיה הבעלים</div>
                      </button>
                    </div>
                    {signupChoice === 'create' && (
                      <div className="space-y-2">
                        <Label htmlFor="orgName">שם הסוכנות</Label>
                        <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="הסוכנות שלי" required />
                      </div>
                    )}
                    {signupChoice === 'join' && (
                      <p className="text-xs text-muted-foreground">
                        אם כבר קיימת סוכנות עם הדומיין שלך, נשלח בקשת הצטרפות למנהל. תקבל גישה אחרי אישור.
                        אם לא קיימת — תיווצר חדשה ותהיה הבעלים שלה.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required dir="ltr" />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer select-none">זכור אותי במכשיר זה</Label>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full h-14 text-lg font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {mode === 'login' && 'התחבר'}
              {mode === 'signup' && 'הרשמה'}
              {mode === 'reset' && 'שלח קישור איפוס'}
            </Button>
          </form>

          <div className="text-center text-sm space-y-2">
            {mode === 'login' && (
              <>
                <button onClick={() => setMode('reset')} className="text-primary hover:underline block w-full">שכחת סיסמה?</button>
                <p className="text-muted-foreground">
                  אין לך חשבון?{' '}
                  <button onClick={() => setMode('signup')} className="text-primary hover:underline">הרשמה</button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground">
                יש לך חשבון?{' '}
                <button onClick={() => setMode('login')} className="text-primary hover:underline">התחבר</button>
              </p>
            )}
            {mode === 'reset' && (
              <button onClick={() => setMode('login')} className="text-primary hover:underline">חזרה להתחברות</button>
            )}
          </div>

          <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground space-x-3 rtl:space-x-reverse">
            <a href="https://agencyos.solutions/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">תנאי שימוש</a>
            <span>·</span>
            <a href="https://agencyos.solutions/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">מדיניות פרטיות</a>
          </div>
        </div>
      </div>
    </div>
  );
}
