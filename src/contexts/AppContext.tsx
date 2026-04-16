import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang } from '@/lib/i18n';

interface AppContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('agencyos-lang') as Lang) || 'he');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('agencyos-theme') as 'dark' | 'light') || 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('agencyos-lang', lang);
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('agencyos-theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return (
    <AppContext.Provider value={{ lang, setLang, theme, setTheme, sidebarOpen, setSidebarOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
