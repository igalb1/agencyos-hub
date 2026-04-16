import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ToggleLeft, ToggleRight, Pencil, CalendarIcon, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string;
  created_at: string;
}

const planColors: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  starter: 'bg-blue-500/15 text-blue-400',
  pro: 'bg-purple-500/15 text-purple-400',
  business: 'bg-amber-500/15 text-amber-400',
};

const PLANS = ['free', 'starter', 'pro', 'business'] as const;

interface OrgRowProps {
  org: OrgRow;
  onUpdate: (updated: OrgRow) => void;
  onDelete: (id: string) => void;
}

export function OrgRowComponent({ org, onUpdate, onDelete }: OrgRowProps) {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingTrial, setEditingTrial] = useState(false);

  const toggleActive = async () => {
    const { error } = await supabase
      .from('organizations')
      .update({ is_active: !org.is_active })
      .eq('id', org.id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      onUpdate({ ...org, is_active: !org.is_active });
      toast({ title: org.is_active ? 'הארגון הושבת' : 'הארגון הופעל' });
    }
  };

  const changePlan = async (newPlan: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ plan: newPlan })
      .eq('id', org.id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      onUpdate({ ...org, plan: newPlan });
      toast({ title: `תוכנית שונתה ל-${newPlan}` });
    }
    setEditingPlan(false);
  };

  const extendTrial = async (date: Date | undefined) => {
    if (!date) return;
    const newDate = date.toISOString();
    const { error } = await supabase
      .from('organizations')
      .update({ trial_ends_at: newDate })
      .eq('id', org.id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      onUpdate({ ...org, trial_ends_at: newDate });
      toast({ title: 'תקופת ניסיון עודכנה' });
    }
    setEditingTrial(false);
  };

  const deleteOrg = async () => {
    // Delete members first, then org
    await supabase.from('organization_members').delete().eq('organization_id', org.id);
    const { error } = await supabase.from('organizations').delete().eq('id', org.id);
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      onDelete(org.id);
      toast({ title: 'הארגון נמחק' });
    }
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30">
      <td className="p-3 font-medium text-foreground">{org.name}</td>
      <td className="p-3">
        {editingPlan ? (
          <Select defaultValue={org.plan} onValueChange={changePlan}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLANS.map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5">
            <Badge className={planColors[org.plan] || planColors.free}>{org.plan}</Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingPlan(true)}>
              <Pencil size={12} className="text-muted-foreground" />
            </Button>
          </div>
        )}
      </td>
      <td className="p-3">
        <Badge className={org.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}>
          {org.is_active ? 'פעיל' : 'מושבת'}
        </Badge>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{new Date(org.trial_ends_at).toLocaleDateString('he-IL')}</span>
          <Popover open={editingTrial} onOpenChange={setEditingTrial}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <CalendarIcon size={12} className="text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={new Date(org.trial_ends_at)}
                onSelect={extendTrial}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </td>
      <td className="p-3 text-muted-foreground">{new Date(org.created_at).toLocaleDateString('he-IL')}</td>
      <td className="p-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={toggleActive} title={org.is_active ? 'השבת' : 'הפעל'}>
            {org.is_active ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} className="text-red-400" />}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" title="מחק ארגון">
                <Trash2 size={16} className="text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>מחיקת ארגון</AlertDialogTitle>
                <AlertDialogDescription>
                  האם אתה בטוח שברצונך למחוק את "{org.name}"? פעולה זו אינה ניתנת לביטול.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={deleteOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
