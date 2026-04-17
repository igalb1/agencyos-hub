import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type Mode = 'login' | 'signup' | 'reset';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast({ title: 'שגיאה', description: 'נא להזין שם סוכנות', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      setLoading(false);
      toast({ title: 'שגיאה', description: authError.message, variant: 'destructive' });
      return;
    }

    if (authData.user) {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName })
        .select('id')
        .single();

      if (org && !orgError) {
        await supabase.from('organization_members').insert({
          organization_id: org.id,
          user_id: authData.user.id,
          role: 'owner',
        });
      }
    }

    setLoading(false);
    toast({
      title: 'נרשמת בהצלחה!',
      description: 'בדוק את האימייל שלך לאימות החשבון.',
    });
    setMode('login');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'נשלח!', description: 'בדוק את האימייל שלך לאיפוס הסיסמה.' });
      setMode('login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Agency</span>
            <span className="text-foreground">OS</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            {mode === 'login' && 'התחבר לחשבון שלך'}
            {mode === 'signup' && 'צור חשבון חדש'}
            {mode === 'reset' && 'איפוס סיסמה'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <form onSubmit={mode === 'login' ? handleLogin : mode === 'signup' ? handleSignup : handleReset} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">שם מלא</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ישראל ישראלי" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgName">שם הסוכנות</Label>
                  <Input id="orgName" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="הסוכנות שלי" required />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required dir="ltr" />
            </div>

            {mode !== 'reset' && (
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required dir="ltr" />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full h-14 text-lg font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {mode === 'login' && 'התחבר'}
              {mode === 'signup' && 'הרשמה'}
              {mode === 'reset' && 'שלח קישור איפוס'}
            </Button>
          </form>

          {/* Links */}
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

          {/* Legal footer */}
          <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground space-x-3 rtl:space-x-reverse">
            <a href="https://agencyos.solutions/terms" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
              תנאי שימוש
            </a>
            <span>·</span>
            <a href="https://agencyos.solutions/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
              מדיניות פרטיות
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
