import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GoogleAdsConnection {
  is_connected: boolean;
  account_name: string | null;
  account_id: string | null;
}

export function useGoogleAdsConnect() {
  const { user } = useAuth();
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

  // Listen for OAuth popup messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'google-ads-success') {
        toast.success(event.data.accountName || 'Google Ads connected');
        fetchConnection();
        setConnecting(false);
      } else if (event.data?.type === 'google-ads-error') {
        toast.error('Failed to connect Google Ads');
        setConnecting(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchConnection]);

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

      // Open OAuth popup
      const width = 500, height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      window.open(result.url, 'google-ads-oauth', `width=${width},height=${height},left=${left},top=${top}`);
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
