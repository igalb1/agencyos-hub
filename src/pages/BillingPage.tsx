import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePlan } from "@/hooks/useEffectivePlan";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PLANS, getPlanById } from "@/lib/plans";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Check, AlertTriangle, Clock, Loader2, ExternalLink } from "lucide-react";

export default function BillingPage() {
  const { user } = useAuth();
  const { plan, paymentStatus, periodEnd, loading } = useEffectivePlan();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  const currentPlan = getPlanById(plan);
  const isPaid = plan !== "free";

  const handleUpgrade = (priceId: string) => {
    openCheckout({
      priceId,
      customerEmail: user?.email || undefined,
      customData: { userId: user?.id || "" },
      successUrl: `${window.location.origin}/settings/billing?checkout=success`,
    });
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("paddle-portal");
      if (error || !data?.overviewUrl) {
        toast({ title: "שגיאה בפתיחת הפורטל", variant: "destructive" });
        return;
      }
      window.open(data.overviewUrl, "_blank");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">חיוב ומנוי</h1>
        <p className="text-muted-foreground mt-1">נהל את התוכנית, אמצעי התשלום והחשבוניות שלך</p>
      </div>

      {paymentStatus === "past_due" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>התשלום נכשל</AlertTitle>
          <AlertDescription>
            התשלום האחרון שלך נכשל. אנא עדכן את אמצעי התשלום כדי להמשיך להשתמש במנוי.
          </AlertDescription>
        </Alert>
      )}

      {paymentStatus === "canceled_grace" && periodEnd && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>המנוי בוטל</AlertTitle>
          <AlertDescription>
            תהיה לך גישה מלאה עד {new Date(periodEnd).toLocaleDateString("he-IL")}.
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard size={20} className="text-primary" />
              <div>
                <CardTitle className="text-lg">התוכנית הנוכחית</CardTitle>
                <CardDescription>
                  {isPaid ? `${currentPlan?.name ?? plan}` : "תקופת ניסיון / Free"}
                </CardDescription>
              </div>
            </div>
            <Badge variant={isPaid ? "default" : "secondary"} className="capitalize">{plan}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentPlan && (
            <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
          )}
          {periodEnd && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {paymentStatus === "canceled_grace" ? "תאריך סיום הגישה" : "חידוש הבא"}
              </span>
              <span className="font-medium">{new Date(periodEnd).toLocaleDateString("he-IL")}</span>
            </div>
          )}
          {isPaid && (
            <Button
              variant="outline"
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="gap-2 w-full sm:w-auto"
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink size={16} />}
              נהל מנוי, אמצעי תשלום וחשבוניות
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{isPaid ? "שדרג / שנה תוכנית" : "בחר תוכנית"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = p.id === plan;
            return (
              <div
                key={p.id}
                className={`relative bg-card border rounded-xl p-5 flex flex-col ${
                  p.popular ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    הכי פופולרי
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <div className="mt-2">
                    <span className="text-2xl font-bold">{p.price}</span>
                    <span className="text-muted-foreground text-sm">/חודש</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-4 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check size={14} className="text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : p.popular ? "default" : "outline"}
                  disabled={checkoutLoading || isCurrent}
                  onClick={() => handleUpgrade(p.priceId)}
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "התוכנית הנוכחית"
                  ) : (
                    "בחר תוכנית"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
