import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";
import { Languages } from "lucide-react";
import { useApp } from "@/contexts/AppContext";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { lang, setLang } = useApp();
  const isHe = lang === "he";

  // Ensure document direction matches current language on public pages
  useEffect(() => {
    document.documentElement.dir = isHe ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [isHe, lang]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground" dir={isHe ? "rtl" : "ltr"}>
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            <span className="text-primary">Agency</span>
            <span>OS</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setLang(isHe ? "en" : "he")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-medium"
              aria-label="Toggle language"
            >
              <Languages size={14} />
              {isHe ? "EN" : "עב"}
            </button>
            <Link
              to="/auth"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {isHe ? "התחברות" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-6 md:grid-cols-3 text-sm">
          <div>
            <div className="text-lg font-bold mb-2">
              <span className="text-primary">Agency</span>OS
            </div>
            <p className="text-muted-foreground">
              {isHe
                ? "מערכת ההפעלה לסוכנויות שיווק דיגיטלי."
                : "The operating system for digital marketing agencies."}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">{isHe ? "מוצר" : "Product"}</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <Link to="/auth" className="hover:text-primary">
                  {isHe ? "התחברות" : "Sign in"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">{isHe ? "מידע משפטי" : "Legal"}</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <Link to="/terms" className="hover:text-primary">
                  {isHe ? "תנאי שימוש" : "Terms of Service"}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary">
                  {isHe ? "מדיניות פרטיות" : "Privacy Policy"}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} AgencyOS — {isHe ? "מופעל על ידי יגאל בר. כל הזכויות שמורות." : "operated by Igal Bar. All rights reserved."}
          </div>
        </div>
      </footer>
    </div>
  );
}
