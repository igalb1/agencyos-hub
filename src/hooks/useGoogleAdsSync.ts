import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GoogleAdsCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: string | null;
  advertising_channel_type: string | null;
  currency_code: string | null;
  budget_amount: number | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversion_value: number;
  ctr: number;
  date_range_start: string;
  date_range_end: string;
  last_synced_at: string;
}

export interface GoogleAdsSyncLogEntry {
  id: string;
  status: string;
  campaigns_synced: number | null;
  accounts_synced: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
}

export function useGoogleAdsSync() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaign[]>([]);
  const [lastSync, setLastSync] = useState<GoogleAdsSyncLogEntry | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const [campRes, logRes] = await Promise.all([
      supabase.from('google_ads_campaigns').select('*')
        .eq('user_id', user.id).order('cost', { ascending: false }),
      supabase.from('google_ads_sync_log').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false })
        .limit(1).maybeSingle(),
    ]);
    setCampaigns((campRes.data as GoogleAdsCampaign[]) ?? []);
    setLastSync((logRes.data as GoogleAdsSyncLogEntry) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sync = async (dateRangeStart?: string, dateRangeEnd?: string) => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-ads', {
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
      console.error('Google Ads sync error:', msg);
      toast.error(`סנכרון נכשל: ${msg}`);
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  return { campaigns, lastSync, syncing, loading, sync, refresh: fetchData };
}