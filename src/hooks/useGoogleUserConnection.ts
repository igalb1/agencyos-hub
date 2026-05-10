import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GoogleUserConnection {
  google_email: string;
  scope: string | null;
  token_expires_at: string | null;
  updated_at: string;
}

export function useGoogleUserConnection() {
  const [connection, setConnection] = useState<GoogleUserConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setConnection(null); setLoading(false); return; }
    const { data } = await supabase
      .from('user_google_connections')
      .select('google_email, scope, token_expires_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setConnection(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Listen for postMessage from the OAuth popup
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== 'google_user_oauth') return;
      setConnecting(false);
      if (e.data.success) {
        toast.success('חשבון Google חובר בהצלחה');
        refresh();
        // Allow other components (sync dialog) to react.
        window.dispatchEvent(new Event('google-user-connection:changed'));
      } else {
        toast.error('ההתחברות נכשלה');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-user-oauth-start', {
        body: { redirect_url: window.location.origin + '/integrations' },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');
      const w = 520, h = 640;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      popupRef.current = window.open(
        data.url, 'google_oauth',
        `width=${w},height=${h},left=${left},top=${top}`,
      );
      if (!popupRef.current) {
        toast.error('דפדפן חסם את חלון ההתחברות. אפשר חלונות קופצים ונסה שוב.');
        setConnecting(false);
      }
    } catch (err) {
      setConnecting(false);
      toast.error(err instanceof Error ? err.message : 'התחברות נכשלה');
    }
  }, []);

  const disconnect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_google_connections')
      .delete()
      .eq('user_id', user.id);
    if (error) { toast.error(error.message); return; }
    toast.success('החיבור נותק');
    setConnection(null);
    window.dispatchEvent(new Event('google-user-connection:changed'));
  }, []);

  return { connection, loading, connecting, connect, disconnect, refresh };
}