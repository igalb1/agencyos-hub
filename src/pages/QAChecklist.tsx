import { Link } from 'react-router-dom';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QAHistoryTable from '@/components/qa/QAHistoryTable';
import { useQAHistory } from '@/hooks/useQAChecklist';

export default function QAChecklistPage() {
  const { items, loading } = useQAHistory();
  return (
    <div className="font-rubik mx-auto max-w-6xl space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl">
            🛡️
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">בקרת איכות קמפיינים</h1>
            <p className="text-sm text-muted-foreground">
              צ'קליסט QA אינטראקטיבי לפני העלאת קמפיינים לאוויר
            </p>
          </div>
        </div>
        <Button asChild className="gap-2">
          <Link to="/qa/new">
            <Plus className="h-4 w-4" /> בדיקה חדשה
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        סך הכל {items.length} בדיקות
      </div>

      {loading ? (
        <div className="rounded-xl border border-border/40 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          טוען היסטוריה...
        </div>
      ) : (
        <QAHistoryTable items={items} />
      )}
    </div>
  );
}