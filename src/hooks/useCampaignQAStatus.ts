import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CampaignQAStatus {
  // Aggregate over all ads in the campaign
  status: 'in_progress' | 'approved' | 'rejected' | 'mixed';
  progress: number; // average across ad checklists (0-100)
  ads_total: number;
  ads_approved: number;
  ads_rejected: number;
  ads_in_progress: number;
  // For deep-link: open the most recently updated checklist
  latest_id: string;
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
      // Group by campaign and aggregate
      const groups = new Map<string, any[]>();
      for (const r of (data ?? []) as any[]) {
        const key = makeKey(r.campaign_name ?? '', r.client_id);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      const next: CampaignQAMap = {};
      for (const [key, rows] of groups) {
        const total = rows.length;
        const approved = rows.filter((r) => r.status === 'approved').length;
        const rejected = rows.filter((r) => r.status === 'rejected').length;
        const inProgress = total - approved - rejected;
        const avgProgress = Math.round(
          rows.reduce((s, r) => s + (r.progress ?? 0), 0) / total,
        );
        let status: CampaignQAStatus['status'];
        if (rejected > 0) status = 'rejected';
        else if (approved === total) status = 'approved';
        else if (approved > 0) status = 'mixed';
        else status = 'in_progress';
        next[key] = {
          status,
          progress: avgProgress,
          ads_total: total,
          ads_approved: approved,
          ads_rejected: rejected,
          ads_in_progress: inProgress,
          latest_id: rows[0].id,
          updated_at: rows[0].updated_at,
        };
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