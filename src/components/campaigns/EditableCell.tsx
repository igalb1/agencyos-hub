import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: number | string;
  onSave: (value: number | string) => void;
  type?: 'number' | 'text' | 'currency';
  formatDisplay: (value: number | string) => string;
  label?: string;
  className?: string;
}

export default function EditableCell({ value, onSave, type = 'number', formatDisplay, label, className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    const parsed = type === 'text' ? draft.trim() : Number(draft);
    if (type === 'text' && typeof parsed === 'string' && parsed.length > 0 && parsed !== value) {
      onSave(parsed);
    } else if (type !== 'text' && !isNaN(parsed as number) && parsed !== value) {
      onSave(parsed);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === 'text' ? 'text' : 'number'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cn(
          "bg-muted border border-primary/40 rounded px-1.5 py-0.5 text-sm text-foreground outline-none w-full text-end",
          type === 'text' && 'text-start',
          className
        )}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className="cursor-pointer group/cell"
      onClick={e => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <p className={cn("text-sm text-foreground group-hover/cell:text-primary transition-colors", className)}>
        {formatDisplay(value)}
      </p>
      {label && <p className="text-[10px] text-muted-foreground">{label}</p>}
    </div>
  );
}
