import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Account { id: string; name: string; manager?: boolean }

interface Props {
  currentAccountId: string | null | undefined;
  isRtl: boolean;
  onChanged?: () => void;
}

export function GoogleAdsAccountPicker({ currentAccountId, isRtl, onChanged }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>(currentAccountId ?? '');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-accounts', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAccounts(data.accounts ?? []);
      if (data.current) setSelected(data.current);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load accounts';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-accounts', {
        body: { account_id: selected },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(isRtl ? `החשבון עודכן: ${data.account_name}` : `Account set: ${data.account_name}`);
      onChanged?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to set account';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">
          {isRtl ? 'חשבון Google Ads' : 'Google Ads account'}
        </label>
        <Select value={selected} onValueChange={setSelected} disabled={loading || accounts.length === 0}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={loading ? (isRtl ? 'טוען...' : 'Loading...') : (isRtl ? 'בחר חשבון' : 'Select account')} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.id}){a.manager ? ' • MCC' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      </Button>
      <Button size="sm" onClick={save} disabled={!selected || saving || selected === currentAccountId}>
        {saving && <Loader2 size={14} className="animate-spin mr-1" />}
        {isRtl ? 'שמור חשבון' : 'Save account'}
      </Button>
    </div>
  );
}
