import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QAItemDef } from '@/types/qa';

const PRIORITY_STYLES: Record<QAItemDef['priority'], { dot: string; label: string; chip: string }> = {
  critical: { dot: 'bg-qa-critical', label: '🔴 קריטי', chip: 'bg-qa-critical/15 text-qa-critical' },
  high: { dot: 'bg-qa-high', label: '🟠 גבוה', chip: 'bg-qa-high/15 text-qa-high' },
  medium: { dot: 'bg-qa-medium', label: '🟢 בינוני', chip: 'bg-qa-medium/15 text-qa-medium' },
};

interface Props {
  item: QAItemDef;
  checked: boolean;
  note: string;
  readOnly?: boolean;
  onToggle: () => void;
  onNoteChange: (s: string) => void;
}

export default function QAItem({ item, checked, note, readOnly, onToggle, onNoteChange }: Props) {
  const [showNote, setShowNote] = useState(!!note);
  const style = PRIORITY_STYLES[item.priority];

  return (
    <div
      className={cn(
        'rounded-lg border border-border/30 bg-card/40 p-3 transition-colors',
        checked && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={() => !readOnly && onToggle()}
          disabled={readOnly}
          className="mt-1 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-sm leading-snug', checked && 'line-through text-muted-foreground')}>
              {item.text}
            </p>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', style.chip)}>
              {style.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowNote((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <StickyNote className="h-3 w-3" />
            {note ? 'ערוך הערה' : 'הוסף הערה'}
          </button>
          {showNote && (
            <Textarea
              dir="rtl"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="כתוב הערה לפריט הזה..."
              disabled={readOnly}
              className="mt-2 min-h-[60px] text-sm"
            />
          )}
          {!showNote && note && (
            <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}