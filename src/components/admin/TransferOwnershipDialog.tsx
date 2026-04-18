import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Member {
  member_id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface TransferOwnershipDialogProps {
  orgId: string;
  orgName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleLabel: Record<string, string> = {
  owner: 'בעלים',
  admin: 'מנהל',
  member: 'חבר',
};

const roleColors: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-400',
  admin: 'bg-purple-500/15 text-purple-400',
  member: 'bg-muted text-muted-foreground',
};

export function TransferOwnershipDialog({ orgId, orgName, open, onOpenChange }: TransferOwnershipDialogProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .rpc('get_org_members_with_details', { _org_id: orgId })
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
        } else if (data) {
          setMembers(data as Member[]);
          const currentOwner = (data as Member[]).find(m => m.role === 'owner');
          if (currentOwner) setSelected(currentOwner.user_id);
        }
        setLoading(false);
      });
  }, [open, orgId, toast]);

  const handleTransfer = async () => {
    if (!selected) return;
    const currentOwner = members.find(m => m.role === 'owner');
    if (currentOwner?.user_id === selected) {
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc('transfer_org_ownership', {
      _org_id: orgId,
      _new_owner_user_id: selected,
    });
    setSubmitting(false);
    const result = data as { success: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({ title: 'שגיאה', description: result?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'הבעלות הועברה בהצלחה' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown size={18} className="text-amber-400" />
            ניהול בעלים — {orgName}
          </DialogTitle>
          <DialogDescription>
            בחר את החבר שיהיה הבעלים החדש. הבעלים הנוכחי יהפוך לאדמין.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">אין חברים בסוכנות זו</p>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2 max-h-80 overflow-y-auto">
            {members.map(m => (
              <Label
                key={m.user_id}
                htmlFor={m.user_id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
              >
                <RadioGroupItem value={m.user_id} id={m.user_id} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{m.full_name || m.email}</div>
                  <div className="text-xs text-muted-foreground truncate" dir="ltr">{m.email}</div>
                </div>
                <Badge className={roleColors[m.role] || roleColors.member}>{roleLabel[m.role] || m.role}</Badge>
              </Label>
            ))}
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>ביטול</Button>
          <Button onClick={handleTransfer} disabled={submitting || loading || !selected}>
            {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
