import { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            <span className="text-primary">Agency</span>
            <span>OS</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
            <Link to="/auth" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Sign in
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
              The operating system for digital marketing agencies.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Product</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li><Link to="/pricing" className="hover:text-primary">Pricing</Link></li>
              <li><Link to="/auth" className="hover:text-primary">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Legal</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
              <li><Link to="/refund" className="hover:text-primary">Refund Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} AgencyOS — operated by Igal Bar. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
