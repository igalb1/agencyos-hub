import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FacebookAdsCampaign {
  id: string;
  account_name: string | null;
  facebook_account_id: string | null;
  campaign_id: string;
  campaign_name: string;
  status: string | null;
  objective: string | null;
  currency_code: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  date_range_start: string;
  date_range_end: string;
  last_synced_at: string;
}

export interface FacebookSyncLogEntry {
  id: string;
  status: string;
  campaigns_synced: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
}

export function useFacebookAdsSync() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<FacebookAdsCampaign[]>([]);
  const [lastSync, setLastSync] = useState<FacebookSyncLogEntry | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [campRes, logRes] = await Promise.all([
      supabase
        .from('facebook_ads_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('spend', { ascending: false }),
      supabase
        .from('facebook_ads_sync_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setCampaigns((campRes.data as FacebookAdsCampaign[]) ?? []);
    setLastSync((logRes.data as FacebookSyncLogEntry) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sync = async (dateRangeStart?: string, dateRangeEnd?: string) => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-facebook-ads', {
        body: {
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          triggered_by: 'manual',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      toast.success(`סונכרנו ${data.campaigns_synced} קמפיינים מ-${data.accounts_synced} חשבונות`);
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      console.error('Facebook sync error:', msg);
      toast.error(`סנכרון נכשל: ${msg}`);
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  return { campaigns, lastSync, syncing, loading, sync, refresh: fetchData };
}