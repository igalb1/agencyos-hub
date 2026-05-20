import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

interface GoogleAdsConnection {
  is_connected: boolean;
  account_name: string | null;
  account_id: string | null;
}

export function useGoogleAdsConnect() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<GoogleAdsConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Detect if user is returning from Google OAuth
  const isReturningFromOAuth = useMemo(() => {
    return searchParams.has('google_ads_success') || searchParams.has('google_ads_error') || searchParams.has('code');
  }, [searchParams]);

  const fetchConnection = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_integrations_safe')
      .select('is_connected, account_name, account_id')
      .eq('user_id', user.id)
      .eq('provider', 'google_ads')
      .maybeSingle();
    setConnection(data as GoogleAdsConnection | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  // Handle OAuth redirect results
  useEffect(() => {
    const success = searchParams.get('google_ads_success');
    const error = searchParams.get('google_ads_error');
    const account = searchParams.get('account');

    if (success) {
      toast.success(account || 'Google Ads connected successfully');
      fetchConnection();
      // Clean URL params
      searchParams.delete('google_ads_success');
      searchParams.delete('account');
      setSearchParams(searchParams, { replace: true });
    } else if (error) {
      const messages: Record<string, string> = {
        token_exchange_failed: 'Failed to exchange token with Google',
        save_failed: 'Failed to save connection',
        missing_params: 'Missing parameters from Google',
        access_denied: 'Access denied by user',
      };
      toast.error(messages[error] || `Connection failed: ${error}`);
      searchParams.delete('google_ads_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, fetchConnection]);

  const connect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-auth', {
        body: { redirect_url: `${window.location.origin}/integrations` },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Missing Google authorization URL');

      // Open in the top-level window to avoid Google blocking OAuth inside preview iframes.
      const target = window.top ?? window;
      try {
        target.location.href = data.url;
      } catch {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Connect error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to initiate connection: ${message}`);
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    await supabase
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google_ads');
    setConnection(null);
    toast.success('Google Ads disconnected');
  };

  return { connection, loading, connecting, isReturningFromOAuth, connect, disconnect };
}
