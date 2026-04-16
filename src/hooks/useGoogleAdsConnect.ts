import { useState, useEffect, useCallback } from 'react';
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

  const fetchConnection = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_integrations')
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/google-ads-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            redirect_url: window.location.origin + '/integrations',
          }),
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Redirect in same window (not popup) to avoid CSP issues
      window.location.href = result.url;
    } catch (err) {
      console.error('Connect error:', err);
      toast.error('Failed to initiate connection');
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

  return { connection, loading, connecting, connect, disconnect };
}
