import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { Bell, Menu, Search, LogOut } from 'lucide-react';

export default function Topbar() {
  const { lang, sidebarOpen, setSidebarOpen } = useApp();
  const { profile, organization, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <Menu size={20} />
          </button>
        )}
        {organization && (
          <span className="text-sm font-semibold text-foreground hidden md:block">{organization.name}</span>
        )}
        <div className="hidden sm:flex items-center gap-2 bg-muted rounded-lg px-3 py-2 w-64">
          <Search size={16} className="text-muted-foreground" />
          <input
            type="text"
            placeholder={t('search', lang)}
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm text-foreground hidden md:block">{profile?.full_name || ''}</span>
        </div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title="התנתק">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
