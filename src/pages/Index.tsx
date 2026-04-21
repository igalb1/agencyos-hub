import { Link } from "react-router-dom";
import PublicLayout from "@/components/public/PublicLayout";
import { Check, BarChart3, Users, Megaphone, CalendarDays, FileText, Plug, LogIn } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

export default function Index() {
  const { lang } = useApp();
  const isHe = lang === "he";

  const features = isHe
    ? [
        { icon: Users, title: "ניהול לקוחות", desc: "ריכוז כל לקוח, איש קשר, תקציב ומדד KPI במקום אחד." },
        { icon: Megaphone, title: "ניהול קמפיינים", desc: "מעקב אחרי כל קמפיין בכל הערוצים ממסך אחד." },
        { icon: BarChart3, title: "ניתוח ביצועים", desc: "דשבורדים בזמן אמת ל-Google Ads, Meta ועוד." },
        { icon: CalendarDays, title: "משימות וצירי זמן", desc: "תכנון בסגנון גאנט שומר על הצוות מסונכרן ובלוח זמנים." },
        { icon: FileText, title: "דוחות אוטומטיים", desc: "צור דוחות לקוח יפים בשניות, לא בשעות." },
        { icon: Plug, title: "אינטגרציות", desc: "חבר Google Ads, Meta, Analytics — הכל במקום אחד." },
      ]
    : [
        { icon: Users, title: "Client management", desc: "Centralize every client, contact, budget, and KPI in one workspace." },
        { icon: Megaphone, title: "Campaign tracking", desc: "Monitor every campaign across channels from a single screen." },
        { icon: BarChart3, title: "Performance analytics", desc: "Real-time dashboards across Google Ads, Meta, and more." },
        { icon: CalendarDays, title: "Tasks & timelines", desc: "Gantt-style planning keeps your team aligned and on schedule." },
        { icon: FileText, title: "Automated reports", desc: "Generate beautiful client reports in seconds, not hours." },
        { icon: Plug, title: "Integrations", desc: "Connect Google Ads, Meta, Analytics — all in one place." },
      ];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          {isHe ? "כעת בבטא ציבורית — 28 ימי ניסיון חינם" : "Now in public beta — 28-day free trial"}
        </span>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          {isHe ? (
            <>
              די לקפוץ בין כלים.<br />
              <span className="text-primary">נהל את הסוכנות שלך במקום אחד.</span>
            </>
          ) : (
            <>
              Stop juggling tools.<br />
              <span className="text-primary">Run your agency in one place.</span>
            </>
          )}
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {isHe
            ? "AgencyOS מחליף דשבורדים מפוזרים, גיליונות וכלי ניהול פרויקטים בפלטפורמה אחת שנבנתה לסוכנויות שיווק דיגיטלי."
            : "AgencyOS replaces scattered dashboards, spreadsheets, and project tools with a single platform built for digital marketing agencies."}
        </p>
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link to="/auth" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
            {isHe ? "התחל 28 ימי ניסיון חינם" : "Start 28-day free trial"}
          </Link>
          <Link to="/pricing" className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-muted transition-colors">
            {isHe ? "צפה בתמחור" : "View pricing"}
          </Link>
        </div>

        {/* Existing customers — large sign in CTA */}
        <div className="flex flex-col items-center gap-3 pt-6 border-t border-border max-w-md mx-auto">
          <p className="text-sm text-muted-foreground">
            {isHe ? "כבר יש לך חשבון בתשלום?" : "Already have a paid account?"}
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-lg font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 transition-all duration-200 w-full"
          >
            <LogIn size={22} />
            {isHe ? "התחברות למערכת" : "Sign in to the system"}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-2">
          {isHe ? "כל מה שהסוכנות שלך צריכה" : "Everything your agency needs"}
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          {isHe ? "נבנה במיוחד לאופן בו סוכנויות מודרניות עובדות." : "Purpose-built for the way modern agencies work."}
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="text-primary" size={20} />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="p-10 rounded-2xl border border-border bg-card">
          <h2 className="text-3xl font-bold mb-3">
            {isHe ? "מוכן לייעל את הסוכנות שלך?" : "Ready to streamline your agency?"}
          </h2>
          <p className="text-muted-foreground mb-6">
            {isHe ? "התחל 28 ימי ניסיון חינם — ללא צורך בכרטיס אשראי." : "Start your 28-day free trial — no credit card required."}
          </p>
          <Link to="/auth" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90">
            <Check size={18} /> {isHe ? "התחל בחינם" : "Get started free"}
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
