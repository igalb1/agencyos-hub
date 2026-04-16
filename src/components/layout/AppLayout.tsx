import { ReactNode, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectivePlan } from '@/hooks/useEffectivePlan';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { paymentStatus, periodEnd } = useEffectivePlan();
  const { refreshOrganization } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle ?checkout=success
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      toast({ title: 'התשלום התקבל!', description: 'התוכנית שלך פעילה.' });
      refreshOrganization();
      const next = new URLSearchParams(searchParams);
      next.delete('checkout');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshOrganization]);

  return (
    <div className="flex h-screen overflow-hidden flex-col">
      <PaymentTestModeBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {paymentStatus === 'past_due' && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>התשלום האחרון נכשל. עדכן את אמצעי התשלום כדי להמשיך.</span>
                  <button
                    onClick={() => navigate('/settings/billing')}
                    className="text-sm font-medium underline shrink-0"
                  >
                    לדף החיוב
                  </button>
                </AlertDescription>
              </Alert>
            )}
            {paymentStatus === 'canceled_grace' && periodEnd && location.pathname !== '/settings/billing' && (
              <Alert className="mb-4">
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  המנוי בוטל. הגישה תסתיים ב-{new Date(periodEnd).toLocaleDateString('he-IL')}.
                </AlertDescription>
              </Alert>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
