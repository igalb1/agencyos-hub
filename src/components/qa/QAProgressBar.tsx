import { cn } from '@/lib/utils';

interface Props {
  progress: number;
  done: number;
  total: number;
  criticalDone: number;
  criticalTotal: number;
}

export default function QAProgressBar({ progress, done, total, criticalDone, criticalTotal }: Props) {
  const color =
    progress < 40 ? 'bg-qa-critical' : progress < 80 ? 'bg-qa-budget' : 'bg-qa-final';
  const criticalAllDone = criticalTotal === 0 || criticalDone === criticalTotal;

  return (
    <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">התקדמות</span>
        <span className="font-rubik font-bold text-foreground">{progress}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {done}/{total} פריטים הושלמו
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-medium',
            criticalAllDone
              ? 'bg-qa-final/15 text-qa-final'
              : 'bg-qa-critical/15 text-qa-critical',
          )}
        >
          🔴 קריטיים: {criticalDone}/{criticalTotal}
        </span>
      </div>
    </div>
  );
}