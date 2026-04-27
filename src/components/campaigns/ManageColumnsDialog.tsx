import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomColumn } from '@/hooks/useCustomColumns';
import { Lang } from '@/lib/i18n';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
  columns: CustomColumn[];
  onAdd: (name: string, type: 'text' | 'number') => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ManageColumnsDialog({ open, onOpenChange, lang, columns, onAdd, onRename, onDelete }: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'number'>('text');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error(lang === 'he' ? 'יש להזין שם עמודה' : 'Column name is required');
      return;
    }
    setBusy(true);
    try {
      await onAdd(newName.trim(), newType);
      setNewName('');
      setNewType('text');
      toast.success(lang === 'he' ? 'העמודה נוספה' : 'Column added');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string, name: string) => {
    if (!name.trim()) return;
    try { await onRename(id, name.trim()); } catch (e: any) { toast.error(e?.message || 'Error'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'he' ? 'למחוק את העמודה? הערכים יימחקו לצמיתות.' : 'Delete column? Values will be permanently removed.')) return;
    try {
      await onDelete(id);
      toast.success(lang === 'he' ? 'העמודה נמחקה' : 'Column deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {lang === 'he' ? 'ניהול עמודות מותאמות' : 'Manage Custom Columns'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Existing columns */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {lang === 'he' ? 'עמודות קיימות' : 'Existing columns'}
            </Label>
            {columns.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {lang === 'he' ? 'אין עמודות מותאמות עדיין' : 'No custom columns yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {columns.map(col => (
                  <div key={col.id} className="flex items-center gap-2 p-2 rounded-md border border-border">
                    <Input
                      defaultValue={col.name}
                      onBlur={e => e.target.value !== col.name && handleRename(col.id, e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground px-2 shrink-0">
                      {col.type === 'number' ? (lang === 'he' ? 'מספר' : 'Number') : (lang === 'he' ? 'טקסט' : 'Text')}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(col.id)} className="text-destructive hover:text-destructive">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add new */}
          <div className="border-t border-border pt-4 space-y-3">
            <Label className="text-xs text-muted-foreground">
              {lang === 'he' ? 'הוסף עמודה חדשה' : 'Add new column'}
            </Label>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">{lang === 'he' ? 'שם' : 'Name'}</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={lang === 'he' ? 'לדוגמה: ROAS' : 'e.g. ROAS'} />
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs">{lang === 'he' ? 'סוג' : 'Type'}</Label>
                <Select value={newType} onValueChange={v => setNewType(v as 'text' | 'number')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{lang === 'he' ? 'טקסט' : 'Text'}</SelectItem>
                    <SelectItem value="number">{lang === 'he' ? 'מספר' : 'Number'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={busy}>
                <Plus size={16} />
                {lang === 'he' ? 'הוסף' : 'Add'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {lang === 'he' ? 'סגור' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}