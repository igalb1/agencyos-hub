import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, FolderKanban, Megaphone, Image, GanttChart,
  CheckSquare, BarChart3, Plug, FileText, CalendarDays,
  Sun, Moon, Languages, ChevronLeft, ChevronRight, X, Shield, Settings
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { key: 'dashboard' as const, icon: LayoutDashboard, path: '/' },
  { key: 'clients' as const, icon: Users, path: '/clients' },
  { key: 'projects' as const, icon: FolderKanban, path: '/projects' },
  { key: 'campaigns' as const, icon: Megaphone, path: '/campaigns' },
  { key: 'ads' as const, icon: Image, path: '/ads' },
  { key: 'timeline' as const, icon: GanttChart, path: '/timeline' },
  { key: 'tasks' as const, icon: CheckSquare, path: '/tasks' },
  { key: 'performance' as const, icon: BarChart3, path: '/performance' },
  { key: 'integrations' as const, icon: Plug, path: '/integrations' },
  { key: 'reports' as const, icon: FileText, path: '/reports' },
  { key: 'calendar' as const, icon: CalendarDays, path: '/calendar' },
  { key: 'settings' as const, icon: Settings, path: '/settings' },
];

export default function Sidebar() {
  const { lang, setLang, theme, setTheme, sidebarOpen, setSidebarOpen } = useApp();
  const { isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isRtl = lang === 'he';

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed top-0 h-full z-50 flex flex-col bg-sidebar border-border transition-all duration-300",
          isRtl ? "right-0 border-l" : "left-0 border-r",
          sidebarOpen ? "w-64" : "w-16",
          "lg:relative",
          !sidebarOpen && "max-lg:hidden"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          {sidebarOpen && (
            <span className="text-xl font-bold">
              <span className="text-primary">Agency</span>
              <span className="text-foreground">OS</span>
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground transition-colors"
          >
            {sidebarOpen ? (
              <span className="lg:block hidden">{isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}</span>
            ) : null}
            {sidebarOpen ? (
              <X size={18} className="lg:hidden" />
            ) : (
              isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.key}
                onClick={() => { navigate(item.path); setSidebarOpen(window.innerWidth >= 1024); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon size={20} className="shrink-0" />
                {sidebarOpen && <span>{t(item.key, lang)}</span>}
              </button>
            );
          })}
          {isSuperAdmin && (
            <button
              onClick={() => { navigate('/admin'); setSidebarOpen(window.innerWidth >= 1024); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-2 border-t border-border pt-3",
                location.pathname === '/admin'
                  ? "bg-destructive/10 text-destructive"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Shield size={20} className="shrink-0" />
              {sidebarOpen && <span>Super Admin</span>}
            </button>
          )}
        </nav>

        {/* Footer controls */}
        <div className="border-t border-border p-3 space-y-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
          </button>
          <button
            onClick={() => setLang(lang === 'he' ? 'en' : 'he')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Languages size={18} />
            {sidebarOpen && <span>{lang === 'he' ? 'English' : 'עברית'}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
