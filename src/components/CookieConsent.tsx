import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie, X } from "lucide-react";

const COOKIE_KEY = "agencyos_cookie_consent_v1";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[100] animate-in slide-in-from-bottom-5"
    >
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">אנו משתמשים בעוגיות</h3>
          <p className="text-xs text-muted-foreground mt-1">
            אנו משתמשים ב-cookies חיוניים לתפקוד המערכת ולשיפור החוויה. למידע נוסף עיין ב
            <Link to="/privacy" className="text-primary hover:underline mr-1">
              מדיניות הפרטיות
            </Link>
            .
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={accept}>
              אישור
            </Button>
            <Button size="sm" variant="ghost" onClick={decline}>
              רק חיוניים
            </Button>
          </div>
        </div>
        <button
          onClick={decline}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="סגור"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
