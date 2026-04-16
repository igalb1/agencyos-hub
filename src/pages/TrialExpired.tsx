import { useAuth } from '@/contexts/AuthContext';
import { usePaddleCheckout } from '@/hooks/usePaddleCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, Check, Loader2 } from 'lucide-react';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    priceId: 'starter_monthly',
    price: '$99',
    description: 'עד 10 לקוחות',
    features: ['ניהול עד 10 לקוחות', 'פרויקטים ללא הגבלה', 'קמפיינים ומודעות', 'דוחות בסיסיים'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceId: 'pro_monthly',
    price: '$199',
    description: 'עד 30 לקוחות',
    features: ['ניהול עד 30 לקוחות', 'הכל ב-Starter', 'דוחות מתקדמים', 'אינטגרציות'],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceId: 'business_monthly',
    price: '$399',
    description: 'ללא הגבלה',
    features: ['לקוחות ללא הגבלה', 'הכל ב-Pro', 'תמיכה מועדפת', 'API גישה'],
  },
];

export default function TrialExpired() {
  const { user, organization, signOut } = useAuth();
  const { openCheckout, loading } = usePaddleCheckout();

  const handleUpgrade = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user?.email || undefined,
      customData: { userId: user?.id || '' },
      successUrl: `${window.location.origin}/?checkout=success`,
    });
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <PaymentTestModeBanner />
      <div className="flex flex-col items-center justify-center min-h-screen p-4 -mt-8">
        <div className="text-center space-y-3 mb-8">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <Clock size={28} className="text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">תקופת הניסיון הסתיימה</h1>
          <p className="text-muted-foreground max-w-md">
            תקופת הניסיון של 60 יום עבור <span className="font-semibold text-foreground">{organization?.name}</span> הסתיימה.
            בחר תוכנית כדי להמשיך.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-card border rounded-xl p-6 flex flex-col ${
                plan.popular ? 'border-primary ring-2 ring-primary/20' : 'border-border'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  הכי פופולרי
                </span>
              )}
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/חודש</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check size={16} className="text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                disabled={loading}
                onClick={() => handleUpgrade(plan.priceId)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'בחר תוכנית'}
              </Button>
            </div>
          ))}
        </div>

        <Button variant="ghost" className="mt-6 gap-2" onClick={signOut}>
          <LogOut size={16} />
          התנתק
        </Button>
      </div>
    </div>
  );
}
