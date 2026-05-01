import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import QAItem from './QAItem';
import type { QASectionDef, QAItemDef } from '@/types/qa';
import type { QAFilterValue } from './QAFilters';

interface Props {
  section: QASectionDef;
  checked: Record<string, boolean>;
  notes: Record<string, string>;
  filter: QAFilterValue;
  readOnly?: boolean;
  onToggle: (item: QAItemDef) => void;
  onNoteChange: (item: QAItemDef, note: string) => void;
}

function applyFilter(items: QAItemDef[], filter: QAFilterValue, checked: Record<string, boolean>) {
  switch (filter) {
    case 'incomplete':
      return items.filter((i) => !checked[i.id]);
    case 'critical':
    case 'high':
    case 'medium':
      return items.filter((i) => i.priority === filter);
    default:
      return items;
  }
}

export default function QASection({ section, checked, notes, filter, readOnly, onToggle, onNoteChange }: Props) {
  const [open, setOpen] = useState(true);
  const visible = applyFilter(section.items, filter, checked);
  const done = section.items.filter((i) => checked[i.id]).length;
  const total = section.items.length;

  if (visible.length === 0 && filter !== 'all') return null;

  return (
    <div
      className="overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur"
      style={{ boxShadow: `0 0 0 1px hsl(var(--${section.colorVar}) / 0.08)` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-card/60"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
            style={{ background: `hsl(var(--${section.colorVar}) / 0.15)` }}
          >
            {section.icon}
          </span>
          <div>
            <h3 className="font-rubik font-semibold text-foreground">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{done}/{total} הושלמו</p>
          </div>
        </div>
        <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/30 p-3">
          {visible.map((item) => (
            <QAItem
              key={item.id}
              item={item}
              checked={!!checked[item.id]}
              note={notes[item.id] ?? ''}
              readOnly={readOnly}
              onToggle={() => onToggle(item)}
              onNoteChange={(s) => onNoteChange(item, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}