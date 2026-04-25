import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { t } from '@/lib/i18n';
import { Bell, Menu, Search, LogOut, Upload, Building2 } from 'lucide-react';
import ImportDataDialog from '@/components/import/ImportDataDialog';

export default function Topbar() {
  const { lang, sidebarOpen, setSidebarOpen } = useApp();
  const { profile, organization, organizations, signOut } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const hasMultiple = organizations.length > 1;
  const isRtl = lang === 'he';

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <Menu size={20} />
          </button>
        )}
        {organization && (
          hasMultiple ? (
            <Link
              to="/select-workspace"
              className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors group"
              title={isRtl ? 'החלף סביבת עבודה' : 'Switch workspace'}
            >
              <Building2 size={14} className="text-muted-foreground group-hover:text-foreground" />
              <span className="text-sm font-semibold text-foreground">{organization.name}</span>
              <span className="text-xs text-muted-foreground">
                {isRtl ? 'החלף' : 'Switch'}
              </span>
            </Link>
          ) : (
            <span className="text-sm font-semibold text-foreground hidden md:block">{organization.name}</span>
          )
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
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
          title="ייבוא נתונים מאקסל / CSV"
        >
          <Upload size={16} />
          <span className="hidden md:inline">ייבוא נתונים</span>
        </button>
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
      <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />
    </header>
  );
}
