import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // Listen for PASSWORD_RECOVERY event fired by Supabase when user lands from recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
        setError(null);
      }
    });

    const init = async () => {
      const hash = window.location.hash;
      const search = window.location.search;

      // Error in hash (e.g. #error=access_denied&error_code=otp_expired)
      if (hash.includes('error=') || search.includes('error=')) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);
        const desc = params.get('error_description') || params.get('error') || 'הקישור פג תוקף או כבר נוצל';
        if (mounted) setError(decodeURIComponent(desc.replace(/\+/g, ' ')));
        return;
      }

      // PKCE flow: ?code=...
      const code = new URLSearchParams(search).get('code');
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          if (mounted) setError('הקישור פג תוקף או כבר נוצל. בקש קישור חדש.');
        } else if (mounted) {
          setReady(true);
        }
        return;
      }

      // Implicit flow: #access_token=...&type=recovery
      if (hash.includes('access_token') || hash.includes('type=recovery')) {
        // onAuthStateChange will fire and set ready
        return;
      }

      // Existing session?
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        if (session) setReady(true);
        else setError('קישור לא תקין. בקש איפוס סיסמה חדש.');
      }
    };

    init();
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'הסיסמה חייבת להכיל לפחות 6 תווים', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'הסיסמה עודכנה בהצלחה!' });
      navigate('/dashboard');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Agency</span>
            <span className="text-foreground">OS</span>
          </h1>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">קישורי איפוס סיסמה תקפים ל-60 דקות וניתנים לשימוש חד-פעמי.</p>
            <Link to="/auth">
              <Button className="w-full">בקש איפוס סיסמה חדש</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-primary">Agency</span>
            <span className="text-foreground">OS</span>
          </h1>
          <p className="text-muted-foreground mt-2">הגדר סיסמה חדשה</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה חדשה</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required dir="ltr" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              עדכן סיסמה
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
