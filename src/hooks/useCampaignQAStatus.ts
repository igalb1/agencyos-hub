import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CampaignQAStatus {
  id: string;
  status: 'in_progress' | 'approved' | 'rejected';
  progress: number;
  critical_complete: boolean;
  updated_at: string;
}

/** key = `${name}|${clientId ?? ''}` (lowercased name) */
export type CampaignQAMap = Record<string, CampaignQAStatus>;

function makeKey(name: string, clientId: string | null | undefined) {
  return `${name.trim().toLowerCase()}|${clientId ?? ''}`;
}

export function useCampaignQAStatus() {
  const { organization } = useAuth();
  const [map, setMap] = useState<CampaignQAMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!organization?.id) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from('qa_checklists')
        .select('id,campaign_name,client_id,status,progress,critical_complete,updated_at')
        .eq('organization_id', organization.id)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      const next: CampaignQAMap = {};
      for (const r of (data ?? []) as any[]) {
        const key = makeKey(r.campaign_name ?? '', r.client_id);
        if (!next[key]) {
          next[key] = {
            id: r.id,
            status: r.status,
            progress: r.progress ?? 0,
            critical_complete: !!r.critical_complete,
            updated_at: r.updated_at,
          };
        }
      }
      setMap(next);
      setLoading(false);
    }
    load();

    if (!organization?.id) return;
    const channel = supabase
      .channel(`qa-status-${organization.id}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'qa_checklists', filter: `organization_id=eq.${organization.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organization?.id]);

  function get(name: string, clientId: string | null | undefined): CampaignQAStatus | undefined {
    return map[makeKey(name, clientId)];
  }

  return { map, get, loading };
}