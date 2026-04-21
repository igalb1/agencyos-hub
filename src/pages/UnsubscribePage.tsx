import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'>('loading');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    (async () => {
      try {
        const r = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const j = await r.json();
        if (j.valid) setState('valid');
        else if (j.reason === 'already_unsubscribed') setState('already');
        else setState('invalid');
      } catch {
        setState('error');
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      setState(j.success ? 'success' : 'already');
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">ביטול הרשמה לאימיילים</h1>
        {state === 'loading' && <p className="text-muted-foreground">טוען...</p>}
        {state === 'valid' && (
          <>
            <p className="text-muted-foreground">
              לחץ על הכפתור כדי להפסיק לקבל אימיילים מאיתנו.
            </p>
            <Button onClick={confirm} disabled={submitting} variant="destructive">
              {submitting ? 'מעבד...' : 'אשר ביטול הרשמה'}
            </Button>
          </>
        )}
        {state === 'already' && <p className="text-muted-foreground">כבר ביטלת הרשמה בעבר.</p>}
        {state === 'success' && <p className="text-foreground">בוטלה הרשמתך בהצלחה.</p>}
        {state === 'invalid' && <p className="text-destructive">הקישור לא תקין או פג תוקף.</p>}
        {state === 'error' && <p className="text-destructive">שגיאה. נסה שוב מאוחר יותר.</p>}
      </div>
    </div>
  );
}