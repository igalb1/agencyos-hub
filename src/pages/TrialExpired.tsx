import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';

export default function TrialExpired() {
  const { organization, signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <Clock size={32} className="text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">תקופת הניסיון הסתיימה</h1>
          <p className="text-muted-foreground mt-2">
            תקופת הניסיון של 60 יום עבור <span className="font-semibold text-foreground">{organization?.name}</span> הסתיימה.
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            כדי להמשיך להשתמש במערכת, יש לשדרג לתוכנית בתשלום. צור קשר עם הצוות שלנו לפרטים נוספים.
          </p>
          <Button className="w-full" size="lg">
            שדרג עכשיו
          </Button>
          <Button variant="ghost" className="w-full gap-2" onClick={signOut}>
            <LogOut size={16} />
            התנתק
          </Button>
        </div>
      </div>
    </div>
  );
}
