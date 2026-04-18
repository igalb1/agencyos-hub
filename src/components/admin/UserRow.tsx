import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Snowflake, Sun, MoreHorizontal, UserMinus, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export interface AdminUser {
  user_id: string;
  full_name: string | null;
  email: string;
  is_frozen: boolean;
  created_at: string;
  organizations: Array<{ org_id: string; org_name: string; role: string }>;
}

const roleLabel: Record<string, string> = { owner: 'בעלים', admin: 'מנהל', member: 'חבר' };
const roleColors: Record<string, string> = {
  owner: 'bg-amber-500/15 text-amber-400',
  admin: 'bg-purple-500/15 text-purple-400',
  member: 'bg-muted text-muted-foreground',
};

interface Props {
  user: AdminUser;
  onChanged: () => void;
}

export function UserRow({ user, onChanged }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [removeDialog, setRemoveDialog] = useState<{ org_id: string; org_name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const callAction = async (action: string, org_id?: string) => {
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_manage_user', {
      _target_user_id: user.user_id,
      _action: action,
      _org_id: org_id ?? null,
    });
    setBusy(false);
    const result = data as { success: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({ title: 'שגיאה', description: result?.error || error?.message, variant: 'destructive' });
      return false;
    }
    onChanged();
    return true;
  };

  const toggleFreeze = async () => {
    const ok = await callAction(user.is_frozen ? 'unfreeze' : 'freeze');
    if (ok) toast({ title: user.is_frozen ? 'המשתמש שוחרר' : 'המשתמש הוקפא' });
  };

  const removeFromOrg = async () => {
    if (!removeDialog) return;
    const ok = await callAction('remove_from_org', removeDialog.org_id);
    if (ok) toast({ title: `הוסר מ-${removeDialog.org_name}` });
    setRemoveDialog(null);
  };

  const deleteUser = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-delete-user', {
      body: { target_user_id: user.user_id },
    });
    setBusy(false);
    const errMsg = (data as { error?: string })?.error || error?.message;
    if (errMsg) {
      toast({ title: 'שגיאה במחיקה', description: errMsg, variant: 'destructive' });
      return;
    }
    toast({ title: 'המשתמש נמחק לחלוטין מהמערכת' });
    setDeleteDialog(false);
    setConfirmText('');
    onChanged();
  };

  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/30">
        <td className="p-3">
          <div className="font-medium text-foreground">{user.full_name || '—'}</div>
          {user.is_frozen && <Badge className="mt-1 bg-blue-500/15 text-blue-400">מוקפא</Badge>}
        </td>
        <td className="p-3 text-muted-foreground" dir="ltr">{user.email || '—'}</td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1">
            {user.organizations.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
            {user.organizations.map(o => (
              <div key={o.org_id} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-0.5 text-xs">
                <span className="text-foreground">{o.org_name}</span>
                <Badge className={`${roleColors[o.role] || roleColors.member} text-[10px] px-1.5 py-0`}>
                  {roleLabel[o.role] || o.role}
                </Badge>
              </div>
            ))}
          </div>
        </td>
        <td className="p-3 text-muted-foreground">{new Date(user.created_at).toLocaleDateString('he-IL')}</td>
        <td className="p-3">
          <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="sm" onClick={toggleFreeze} disabled={busy} title={user.is_frozen ? 'שחרר הקפאה' : 'הקפא משתמש'}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : user.is_frozen ? <Sun size={16} className="text-amber-400" /> : <Snowflake size={16} className="text-blue-400" />}
            </Button>
            {user.organizations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={busy}>
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">הסר מסוכנות</div>
                  <DropdownMenuSeparator />
                  {user.organizations.map(o => (
                    <DropdownMenuItem
                      key={o.org_id}
                      onClick={() => setRemoveDialog({ org_id: o.org_id, org_name: o.org_name })}
                      className="text-destructive focus:text-destructive"
                      disabled={o.role === 'owner'}
                    >
                      <UserMinus size={14} className="ml-2" />
                      {o.org_name} {o.role === 'owner' && '(בעלים)'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialog(true)}
              disabled={busy}
              title="מחק משתמש לחלוטין"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </td>
      </tr>

      <AlertDialog open={!!removeDialog} onOpenChange={(open) => !open && setRemoveDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>הסרת משתמש מסוכנות</AlertDialogTitle>
            <AlertDialogDescription>
              האם להסיר את {user.full_name || user.email} מ-"{removeDialog?.org_name}"? המשתמש לא יוכל יותר לגשת לנתוני סוכנות זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={removeFromOrg} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">הסר</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialog} onOpenChange={(open) => { if (!open) { setDeleteDialog(false); setConfirmText(''); } }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ מחיקה לחלוטין מהמערכת</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  פעולה זו תמחק לצמיתות את <strong>{user.full_name || user.email}</strong> מ-auth, פרופיל, חברויות בסוכנויות, מנויים, אינטגרציות ותפקידים.
                </div>
                <div className="text-destructive font-semibold">פעולה זו אינה הפיכה!</div>
                <div className="mt-2">להמשך, הקלד <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">DELETE</code></div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            dir="ltr"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteUser}
              disabled={confirmText !== 'DELETE' || busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 size={14} className="animate-spin ml-2" /> : null}
              מחק לצמיתות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
