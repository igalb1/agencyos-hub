import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QA_PLATFORM_LABEL } from '@/data/qaChecklistData';
import type { QAChecklistRow } from '@/types/qa';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  in_progress: { label: 'בתהליך', cls: 'bg-qa-budget/15 text-qa-budget' },
  approved: { label: 'אושר', cls: 'bg-qa-final/15 text-qa-final' },
  rejected: { label: 'נדחה', cls: 'bg-qa-critical/15 text-qa-critical' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function QAHistoryTable({ items }: { items: QAChecklistRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        אין עדיין בדיקות QA. צור בדיקה חדשה כדי להתחיל.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/40 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="border-b border-border/40 bg-muted/20 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 text-right">קמפיין</th>
            <th className="px-4 py-3 text-right">לקוח</th>
            <th className="px-4 py-3 text-right">פלטפורמה</th>
            <th className="px-4 py-3 text-right">סטטוס</th>
            <th className="px-4 py-3 text-right">התקדמות</th>
            <th className="px-4 py-3 text-right">בודק</th>
            <th className="px-4 py-3 text-right">תאריך</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const st = STATUS_LABEL[it.status] ?? STATUS_LABEL.in_progress;
            return (
              <tr key={it.id} className="border-b border-border/20 hover:bg-card/60">
                <td className="px-4 py-3 font-medium text-foreground">{it.campaign_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{it.client_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{QA_PLATFORM_LABEL[it.platform]}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{it.progress}%</td>
                <td className="px-4 py-3 text-muted-foreground">{it.created_by_name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(it.created_at)}</td>
                <td className="px-4 py-3 text-left">
                  <Link to={`/qa/${it.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Eye className="h-4 w-4" /> פתח
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}