import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GoogleAdsIntegration {
  id: string;
  is_connected: boolean;
  account_name: string | null;
  account_id: string | null;
}

export function useGoogleAdsConnect() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<GoogleAdsIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [isReturningFromOAuth, setIsReturningFromOAuth] = useState(false);

  const fetchConnection = useCallback(async () => {
    if (!user) { setConnection(null); setLoading(false); return; }
    const { data } = await supabase
      .from('user_integrations_safe')
      .select('id, is_connected, account_name, account_id')
      .eq('user_id', user.id)
      .eq('provider', 'google_ads')
      .maybeSingle();
    setConnection(data as GoogleAdsIntegration | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get('google_ads_connected');
    const err = params.get('google_ads_error');
    if (ok || err) {
      setIsReturningFromOAuth(true);
      if (ok) {
        toast.success('Google Ads מחובר בהצלחה');
        fetchConnection();
      } else if (err) {
        toast.error(`חיבור Google Ads נכשל: ${err}`);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('google_ads_connected');
      url.searchParams.delete('google_ads_error');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => setIsReturningFromOAuth(false), 1500);
    }
  }, [fetchConnection]);

  const connect = useCallback(async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-auth', {
        body: { redirect_url: `${window.location.origin}/integrations` },
      });
      if (error) throw error;
      if (data?.url) {
        const target = window.top ?? window;
        try { target.location.href = data.url; } catch { window.open(data.url, '_blank', 'noopener,noreferrer'); }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`לא ניתן להתחיל חיבור: ${msg}`);
      setConnecting(false);
    }
  }, [user]);

  const disconnect = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from('user_integrations').delete()
      .eq('user_id', user.id).eq('provider', 'google_ads');
    if (error) { toast.error(error.message); return; }
    toast.success('Google Ads נותק');
    setConnection(null);
  }, [user]);

  return { connection, loading, connecting, connect, disconnect, isReturningFromOAuth, refetch: fetchConnection };
}