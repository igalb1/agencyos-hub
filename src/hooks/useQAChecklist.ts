import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { QAChecklistRow, QAPlatform, QASectionDef } from '@/types/qa';
import { computeProgress } from '@/data/qaChecklistData';

interface UseQAChecklistOpts {
  id?: string;
}

const PLATFORM_MAP: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
};

async function syncToCampaign(row: QAChecklistRow): Promise<{ campaignId: string; created: boolean }> {
  const platform = PLATFORM_MAP[row.platform] ?? 'Meta';
  const name = row.campaign_name.trim();

  // Try to find an existing campaign by name (+ client if available)
  let query = supabase
    .from('campaigns')
    .select('id')
    .eq('organization_id', row.organization_id)
    .eq('name', name)
    .limit(1);
  if (row.client_id) query = query.eq('client_id', row.client_id);

  const { data: existing } = await query;
  if (existing && existing.length > 0) {
    const campaignId = existing[0].id;
    await supabase
      .from('campaigns')
      .update({ status: 'Live', platform, client_id: row.client_id ?? null })
      .eq('id', campaignId);
    return { campaignId, created: false };
  }

  const { data: created, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: row.organization_id,
      client_id: row.client_id ?? null,
      name,
      platform,
      status: 'Live',
      objective: 'leads',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { campaignId: created.id, created: true };
}

export function useQAChecklist({ id }: UseQAChecklistOpts = {}) {
  const { organization, user, profile } = useAuth();
  const [row, setRow] = useState<QAChecklistRow | null>(null);
  const [loading, setLoading] = useState(!!id);
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('qa_checklists')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (data) setRow(data as QAChecklistRow);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(
    async (input: {
      clientId: string | null;
      clientName: string;
      campaignName: string;
      adName: string;
      adId?: string | null;
      platform: QAPlatform;
      sections: QASectionDef[];
      templateId?: string | null;
    }) => {
      if (!organization?.id || !user?.id) throw new Error('No org/user');
      // Ensure a campaign_ads row exists for this ad
      let adId = input.adId ?? null;
      if (!adId) {
        // First, ensure the campaign exists (or create it)
        const platformLabel = PLATFORM_MAP[input.platform] ?? 'Meta';
        let campaignId: string | null = null;
        let q = supabase
          .from('campaigns')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('name', input.campaignName.trim())
          .limit(1);
        if (input.clientId) q = q.eq('client_id', input.clientId);
        const { data: existingCamp } = await q;
        if (existingCamp && existingCamp.length > 0) {
          campaignId = existingCamp[0].id;
        } else {
          const { data: newCamp, error: cErr } = await supabase
            .from('campaigns')
            .insert({
              organization_id: organization.id,
              client_id: input.clientId,
              name: input.campaignName.trim(),
              platform: platformLabel,
              status: 'Planned',
              objective: 'leads',
            })
            .select('id')
            .single();
          if (cErr) throw cErr;
          campaignId = newCamp.id;
        }
        const { data: newAd, error: adErr } = await (supabase as any)
          .from('campaign_ads')
          .insert({
            organization_id: organization.id,
            campaign_id: campaignId,
            name: input.adName.trim() || 'מודעה ללא שם',
            status: 'draft',
            created_by: user.id,
          })
          .select('id')
          .single();
        if (adErr) throw adErr;
        adId = newAd.id;
      }

      const { data, error } = await (supabase as any)
        .from('qa_checklists')
        .insert({
          organization_id: organization.id,
          client_id: input.clientId,
          client_name: input.clientName,
          campaign_name: input.campaignName,
          ad_id: adId,
          ad_name: input.adName,
          scope: 'ad',
          platform: input.platform,
          template_id: input.templateId ?? null,
          template_snapshot: input.sections,
          checked_items: {},
          notes: {},
          status: 'in_progress',
          progress: 0,
          critical_complete: false,
          created_by: user.id,
          created_by_name: profile?.full_name ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as QAChecklistRow;
    },
    [organization?.id, user?.id, profile?.full_name],
  );

  // Update with debounce + immediate critical-flush
  const queueSave = useCallback(
    (next: QAChecklistRow, immediate = false) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const persist = async () => {
        const { progress, criticalComplete } = computeProgress(
          next.template_snapshot,
          next.checked_items,
        );
        await (supabase as any)
          .from('qa_checklists')
          .update({
            checked_items: next.checked_items,
            notes: next.notes,
            progress,
            critical_complete: criticalComplete,
          })
          .eq('id', next.id);
      };
      if (immediate) {
        persist();
      } else {
        saveTimer.current = window.setTimeout(persist, 800);
      }
    },
    [],
  );

  const toggleItem = useCallback(
    (itemId: string, isCritical: boolean) => {
      setRow((prev) => {
        if (!prev) return prev;
        const checked = { ...prev.checked_items, [itemId]: !prev.checked_items[itemId] };
        const stats = computeProgress(prev.template_snapshot, checked);
        const next: QAChecklistRow = {
          ...prev,
          checked_items: checked,
          progress: stats.progress,
          critical_complete: stats.criticalComplete,
        };
        queueSave(next, isCritical);
        return next;
      });
    },
    [queueSave],
  );

  const setNote = useCallback(
    (itemId: string, note: string) => {
      setRow((prev) => {
        if (!prev) return prev;
        const notes = { ...prev.notes };
        if (note.trim()) notes[itemId] = note;
        else delete notes[itemId];
        const next = { ...prev, notes };
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  const approve = useCallback(async () => {
    if (!row) return;
    // 1) Sync to campaigns (ensure exists & set Live)
    let syncResult: { campaignId: string; created: boolean } | null = null;
    try {
      syncResult = await syncToCampaign(row);
    } catch (e) {
      console.error('[QA] sync to campaign failed', e);
      throw e;
    }

    // 1b) Mark the ad as live too
    if (row.ad_id) {
      await (supabase as any)
        .from('campaign_ads')
        .update({ status: 'live' })
        .eq('id', row.ad_id);
    }

    // 2) Mark checklist as approved
    const { error } = await (supabase as any)
      .from('qa_checklists')
      .update({
        status: 'approved',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw error;
    setRow({ ...row, status: 'approved', approved_at: new Date().toISOString(), approved_by: user?.id ?? null });
    return syncResult;
  }, [row, user?.id]);

  const reject = useCallback(async () => {
    if (!row) return;
    const { error } = await (supabase as any)
      .from('qa_checklists')
      .update({
        status: 'rejected',
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) throw error;
    setRow({ ...row, status: 'rejected', approved_at: new Date().toISOString(), approved_by: user?.id ?? null });
  }, [row, user?.id]);

  // Realtime sync
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`qa-checklist-${id}`)
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'qa_checklists', filter: `id=eq.${id}` },
        (payload: any) => {
          if (payload.new) setRow((p) => (p ? { ...p, ...(payload.new as any) } : (payload.new as any)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  return { row, setRow, loading, create, toggleItem, setNote, approve, reject, reload: load };
}

export function useQAHistory() {
  const { organization } = useAuth();
  const [items, setItems] = useState<QAChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('qa_checklists')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false });
    setItems((data as QAChecklistRow[]) ?? []);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, reload: load };
}