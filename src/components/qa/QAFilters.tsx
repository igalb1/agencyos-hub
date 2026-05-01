import { cn } from '@/lib/utils';

export type QAFilterValue = 'all' | 'incomplete' | 'critical' | 'high' | 'medium';

const FILTERS: { value: QAFilterValue; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'incomplete', label: 'לא הושלמו' },
  { value: 'critical', label: '🔴 קריטי' },
  { value: 'high', label: '🟠 גבוה' },
  { value: 'medium', label: '🟢 בינוני' },
];

export default function QAFilters({
  value,
  onChange,
}: {
  value: QAFilterValue;
  onChange: (v: QAFilterValue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            value === f.value
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border/40 bg-card/40 text-muted-foreground hover:bg-card/80',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}