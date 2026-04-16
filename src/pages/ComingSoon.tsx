import { useApp } from '@/contexts/AppContext';
import { t } from '@/lib/i18n';
import { Construction } from 'lucide-react';

export default function ComingSoon({ title }: { title: string }) {
  const { lang } = useApp();
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <Construction size={48} className="text-primary/50" />
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground">{t('comingSoon', lang)}</p>
    </div>
  );
}
