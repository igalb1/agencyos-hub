import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Account { id: string; name: string; manager?: boolean; parent?: string }

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
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-accounts', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAccounts(data.accounts ?? []);
      if (data.current) setSelected(String(data.current).split(':')[0]);
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
      const acc = accounts.find(a => a.id === selected);
      const { data, error } = await supabase.functions.invoke('google-ads-accounts', {
        body: { account_id: selected, login_customer_id: acc?.parent ?? null },
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q));
  }, [accounts, query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs text-muted-foreground">
          {isRtl ? 'בחר את חשבון ה-Google Ads לסנכרון' : 'Pick the Google Ads account to sync'}
          {accounts.length > 0 && <span className="ml-1">({accounts.length})</span>}
        </label>
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isRtl ? 'חיפוש...' : 'Search...'}
            className="h-8 w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </Button>
          <Button size="sm" onClick={save} disabled={!selected || saving || selected === currentAccountId}>
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            {isRtl ? 'שמור חשבון' : 'Save account'}
          </Button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/30">
        {loading && accounts.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground text-center">
            {isRtl ? 'טוען חשבונות...' : 'Loading accounts...'}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground text-center">
            {isRtl ? 'אין חשבונות' : 'No accounts'}
          </div>
        )}
        {filtered.map(a => {
          const isSelected = selected === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-accent/50 transition-colors ${isSelected ? 'bg-accent' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Check size={14} className={isSelected ? 'opacity-100 text-primary' : 'opacity-0'} />
                <span className="truncate font-medium">{a.name}</span>
                {a.manager && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary-foreground">MCC</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{a.id}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {isRtl
          ? 'הערה: חשבונות MCC הם חשבונות ניהול ולא ניתנים לסנכרון ישיר — בחר חשבון לקוח.'
          : 'Note: MCC accounts are manager accounts and cannot be synced directly — pick a client account.'}
      </p>
    </div>
  );
}
