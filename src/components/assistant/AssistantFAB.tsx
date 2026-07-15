import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

export default function AssistantFAB() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useApp();
  const isRtl = lang === 'he';
  if (location.pathname.startsWith('/assistant')) return null;
  return (
    <button
      onClick={() => navigate('/assistant')}
      title={isRtl ? 'עוזר AI' : 'AI Assistant'}
      className={cn(
        'fixed bottom-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-all flex items-center justify-center',
        isRtl ? 'left-6' : 'right-6'
      )}
    >
      <Sparkles className="h-6 w-6" />
    </button>
  );
}