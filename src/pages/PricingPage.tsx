import { Link, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import PublicLayout from "@/components/public/PublicLayout";
import { PLANS } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  const handleSelect = (priceId: string) => {
    if (!user) {
      navigate(`/auth?plan=${priceId}`);
      return;
    }
    openCheckout({
      priceId,
      customerEmail: user.email || undefined,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/settings/billing?checkout=success`,
    });
  };

  return (
    <PublicLayout>
      <section className="max-w-6xl mx-auto px-6 py-16" dir="rtl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">תמחור פשוט לכל סוכנות</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            התחל בתקופת ניסיון חינם. שדרג כשתרצה. בטל בכל עת.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative bg-card border rounded-2xl p-6 flex flex-col ${
                p.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  הכי פופולרי
                </span>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-3">
                  <span className="text-4xl font-bold">{p.price}</span>
                  <span className="text-muted-foreground">/חודש</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSelect(p.priceId)}
                disabled={loading}
                className={`w-full text-center py-2.5 rounded-lg font-medium transition-opacity flex items-center justify-center gap-2 ${
                  p.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border hover:bg-muted"
                } disabled:opacity-50`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (user ? "בחר תוכנית" : "התחל ניסיון חינם")}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          כל התוכניות בחיוב בדולרים. התשלומים מעובדים בצורה מאובטחת ע״י Paddle, סוחר הרשם שלנו.
          ראה <Link to="/refund" className="text-primary hover:underline">מדיניות החזרים</Link>.
        </p>
      </section>
    </PublicLayout>
  );
}
