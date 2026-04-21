import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectivePlan } from '@/hooks/useEffectivePlan';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function TrialBanner() {
  const { organization } = useAuth();
  const { plan, hasAccess } = useEffectivePlan();
  const navigate = useNavigate();

  // Only show during active free-trial
  if (!organization || plan !== 'free' || !hasAccess) return null;
  if (!organization.trial_ends_at) return null;

  const msLeft = new Date(organization.trial_ends_at).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  const urgent = daysLeft <= 3;

  return (
    <div
      dir="rtl"
      className={`w-full px-4 py-2 flex items-center justify-center gap-3 text-sm border-b ${
        urgent
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-primary/10 border-primary/30 text-foreground'
      }`}
    >
      <Sparkles size={16} className={urgent ? 'text-destructive' : 'text-primary'} />
      <span>
        {daysLeft === 0
          ? 'תקופת הניסיון מסתיימת היום'
          : `נותרו ${daysLeft} ימים בתקופת הניסיון`}
      </span>
      <Button
        size="sm"
        variant={urgent ? 'destructive' : 'default'}
        onClick={() => navigate('/settings/billing')}
        className="h-7"
      >
        שדרג עכשיו
      </Button>
    </div>
  );
}