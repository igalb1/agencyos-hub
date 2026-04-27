import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomColumn } from '@/hooks/useCustomColumns';
import { Lang } from '@/lib/i18n';
import { toast } from 'sonner';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { FORMULA_VARIABLES, validateFormula } from '@/lib/formula';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
  columns: CustomColumn[];
  onAdd: (name: string, type: 'text' | 'number' | 'formula', formula?: string | null) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onUpdateFormula: (id: string, formula: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function ManageColumnsDialog({ open, onOpenChange, lang, columns, onAdd, onRename, onUpdateFormula, onDelete }: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'text' | 'number' | 'formula'>('text');
  const [newFormula, setNewFormula] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) {
      toast.error(lang === 'he' ? 'יש להזין שם עמודה' : 'Column name is required');
      return;
    }
    if (newType === 'formula') {
      const v = validateFormula(newFormula);
      if (!v.ok) {
        toast.error(lang === 'he' ? `נוסחה לא תקינה: ${v.error}` : `Invalid formula: ${v.error}`);
        return;
      }
    }
    setBusy(true);
    try {
      await onAdd(newName.trim(), newType, newType === 'formula' ? newFormula.trim() : null);
      setNewName('');
      setNewType('text');
      setNewFormula('');
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

  const handleFormulaBlur = async (id: string, formula: string, original: string | null) => {
    if (formula === (original ?? '')) return;
    const v = validateFormula(formula);
    if (!v.ok) {
      toast.error(lang === 'he' ? `נוסחה לא תקינה: ${v.error}` : `Invalid formula: ${v.error}`);
      return;
    }
    try {
      await onUpdateFormula(id, formula);
      toast.success(lang === 'he' ? 'הנוסחה עודכנה' : 'Formula updated');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border max-h-[85vh] overflow-y-auto">
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
                  <div key={col.id} className="p-2 rounded-md border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue={col.name}
                        onBlur={e => e.target.value !== col.name && handleRename(col.id, e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground px-2 shrink-0 flex items-center gap-1">
                        {col.type === 'formula' && <Calculator size={12} />}
                        {col.type === 'number' ? (lang === 'he' ? 'מספר' : 'Number')
                          : col.type === 'formula' ? (lang === 'he' ? 'נוסחה' : 'Formula')
                          : (lang === 'he' ? 'טקסט' : 'Text')}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(col.id)} className="text-destructive hover:text-destructive">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    {col.type === 'formula' && (
                      <Input
                        defaultValue={col.formula ?? ''}
                        placeholder="spend / leads"
                        onBlur={e => handleFormulaBlur(col.id, e.target.value, col.formula)}
                        className="font-mono text-sm"
                      />
                    )}
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
              <div className="w-36 space-y-1.5">
                <Label className="text-xs">{lang === 'he' ? 'סוג' : 'Type'}</Label>
                <Select value={newType} onValueChange={v => setNewType(v as 'text' | 'number' | 'formula')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{lang === 'he' ? 'טקסט' : 'Text'}</SelectItem>
                    <SelectItem value="number">{lang === 'he' ? 'מספר' : 'Number'}</SelectItem>
                    <SelectItem value="formula">{lang === 'he' ? 'מחושב (נוסחה)' : 'Calculated (formula)'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={busy}>
                <Plus size={16} />
                {lang === 'he' ? 'הוסף' : 'Add'}
              </Button>
            </div>

            {newType === 'formula' && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label className="text-xs flex items-center gap-1.5">
                  <Calculator size={12} />
                  {lang === 'he' ? 'נוסחה' : 'Formula'}
                </Label>
                <Input
                  value={newFormula}
                  onChange={e => setNewFormula(e.target.value)}
                  placeholder="spend / leads"
                  className="font-mono text-sm"
                />
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <p>
                    {lang === 'he' ? 'משתנים זמינים:' : 'Available variables:'}{' '}
                    {FORMULA_VARIABLES.map((v, i) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setNewFormula(f => f + (f && !/[\s+\-*/(]$/.test(f) ? ' ' : '') + v)}
                        className="font-mono text-primary hover:underline mx-0.5"
                      >
                        {v}{i < FORMULA_VARIABLES.length - 1 ? ',' : ''}
                      </button>
                    ))}
                  </p>
                  <p>{lang === 'he' ? 'אופרטורים: + - * / % ( )' : 'Operators: + - * / % ( )'}</p>
                  <p className="text-muted-foreground/70">
                    {lang === 'he' ? 'דוגמאות:' : 'Examples:'}{' '}
                    <code className="font-mono">spend / leads</code>,{' '}
                    <code className="font-mono">(clicks / impressions) * 100</code>,{' '}
                    <code className="font-mono">conversions * 50 - spend</code>
                  </p>
                </div>
              </div>
            )}
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