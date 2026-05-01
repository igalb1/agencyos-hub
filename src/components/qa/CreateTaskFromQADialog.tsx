import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { QAChecklistRow } from '@/types/qa';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  qaRow: QAChecklistRow | null;
}

export default function CreateTaskFromQADialog({ open, onOpenChange, qaRow }: Props) {
  const { organization } = useAuth();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize when dialog opens
  if (open && qaRow && title === '') {
    const adPart = qaRow.ad_name ? ` — ${qaRow.ad_name}` : '';
    setTitle(`QA: ${qaRow.campaign_name}${adPart}`);
  }

  const handleClose = (v: boolean) => {
    if (!v) {
      setTitle('');
      setPriority('medium');
      setAssignee('');
      setDueDate('');
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    if (!organization?.id || !qaRow || !title.trim()) return;
    setSaving(true);
    try {
      // Try to find matching campaign by name for linking
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('name', qaRow.campaign_name)
        .limit(1);
      const campaignId = camps?.[0]?.id ?? null;

      const { error } = await supabase.from('tasks').insert({
        organization_id: organization.id,
        title: title.trim(),
        description: `נוצר מבדיקת QA${qaRow.ad_name ? ` (מודעה: ${qaRow.ad_name})` : ''}`,
        client_id: qaRow.client_id,
        campaign_id: campaignId,
        assignee: assignee || null,
        priority,
        status: 'todo',
        due_date: dueDate || null,
      });
      if (error) throw error;
      toast.success('המשימה נוצרה ונוספה לדף המשימות');
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message || 'שגיאה ביצירת משימה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>צור משימה מבדיקת QA</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>כותרת המשימה</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>עדיפות</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">גבוהה</SelectItem>
                  <SelectItem value="medium">בינונית</SelectItem>
                  <SelectItem value="low">נמוכה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>תאריך יעד</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>אחראי</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="שם האחראי" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>ביטול</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'יוצר...' : 'צור משימה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}