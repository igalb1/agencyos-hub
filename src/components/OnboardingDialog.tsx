import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/hooks/useOrgData';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, FolderKanban, Megaphone, Plug, CheckCircle2 } from 'lucide-react';

const ONBOARDING_KEY = 'agencyos_onboarded_v1';

export function OnboardingDialog() {
  const { user, organization } = useAuth();
  const { clients } = useOrgData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !organization) return;
    const seen = localStorage.getItem(`${ONBOARDING_KEY}_${user.id}`);
    // Show only for fresh accounts: no clients yet AND not dismissed
    if (!seen && clients.length === 0) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user, organization, clients.length]);

  const dismiss = () => {
    if (user) localStorage.setItem(`${ONBOARDING_KEY}_${user.id}`, '1');
    setOpen(false);
  };

  const go = (path: string) => {
    dismiss();
    navigate(path);
  };

  const steps = [
    { icon: Users, title: 'הוסף לקוח ראשון', desc: 'התחל בניהול לקוחות הסוכנות', path: '/clients' },
    { icon: FolderKanban, title: 'צור פרויקט', desc: 'נהל פרויקטים תחת כל לקוח', path: '/projects' },
    { icon: Megaphone, title: 'הוסף קמפיין', desc: 'עקוב אחרי תקציב, הוצאות ולידים', path: '/campaigns' },
    { icon: Plug, title: 'חבר אינטגרציות', desc: 'Google Ads, LinkedIn ועוד', path: '/integrations' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <CheckCircle2 className="text-primary" size={22} />
            ברוך הבא ל-AgencyOS! 🎉
          </DialogTitle>
          <DialogDescription className="text-right">
            יש לך 14 ימי ניסיון חינם. בוא נתחיל בכמה צעדים פשוטים:
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {steps.map((s) => (
            <button
              key={s.path}
              onClick={() => go(s.path)}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-right"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" onClick={dismiss}>
            דלג ואחקור לבד
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}