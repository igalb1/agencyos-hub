import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type SyncFrequency = 'manual' | 'hourly' | 'every_6_hours' | 'daily' | 'weekly';
export type SyncMode = 'flat' | 'hierarchical';

export interface SheetSyncConfig {
  id: string;
  organization_id: string;
  name: string;
  spreadsheet_id: string;
  sheet_name: string;
  range_a1: string;
  header_row: number;
  column_mapping: Record<string, string>;
  match_field: string;
  frequency: SyncFrequency;
  sync_mode: SyncMode;
  is_active: boolean;
  last_synced_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

export interface SheetSyncLog {
  id: string;
  config_id: string;
  status: string;
  rows_read: number | null;
  clients_created: number | null;
  clients_updated: number | null;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
}

export type SyncStreamEvent =
  | { type: 'stage'; stage: 'loading_config' | 'fetching_sheet' | 'empty'; sheet?: string }
  | { type: 'rows_read'; total: number; headers: string[] }
  | {
      type: 'row';
      row: number;
      action: 'created' | 'updated' | 'skipped' | 'error';
      name?: string;
      reason?: string;
      error?: string;
    }
  | {
      type: 'done';
      success: boolean;
      rows_read?: number;
      created?: number;
      updated?: number;
      skipped?: number;
      failed?: number;
      campaigns_created?: number;
      campaigns_updated?: number;
      error?: string;
    };

export function useClientSheetSync() {
  const { organization } = useAuth();
  const [configs, setConfigs] = useState<SheetSyncConfig[]>([]);
  const [logs, setLogs] = useState<SheetSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!organization?.id) { setLoading(false); return; }
    const [{ data: cfg }, { data: lg }] = await Promise.all([
      supabase.from('client_sheet_sync_configs').select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false }),
      supabase.from('client_sheet_sync_logs').select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setConfigs((cfg ?? []) as unknown as SheetSyncConfig[]);
    setLogs((lg ?? []) as SheetSyncLog[]);
    setLoading(false);
  }, [organization?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchMetadata = async (spreadsheetId: string, sheetName?: string, headerRow = 1) => {
    const { data, error } = await supabase.functions.invoke('google-sheet-metadata', {
      body: { spreadsheet_id: spreadsheetId, sheet_name: sheetName, header_row: headerRow },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Failed to load sheet');
    return data as {
      success: true; spreadsheet_id: string; title: string;
      sheet_name?: string;
      sheets: { title: string; sheetId: number; rowCount: number; columnCount: number }[];
      headers: string[]; sample: string[][]; effective_header_row?: number; effective_range_a1?: string;
    };
  };

  const upsertConfig = async (input: Partial<SheetSyncConfig> & { id?: string }) => {
    if (!organization?.id) throw new Error('No organization');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (input.id) {
      const { error } = await supabase.from('client_sheet_sync_configs')
        .update({
          name: input.name, spreadsheet_id: input.spreadsheet_id,
          sheet_name: input.sheet_name, range_a1: input.range_a1,
          header_row: input.header_row, column_mapping: input.column_mapping,
          match_field: input.match_field, frequency: input.frequency,
          sync_mode: input.sync_mode, is_active: input.is_active,
        })
        .eq('id', input.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('client_sheet_sync_configs').insert({
        organization_id: organization.id,
        created_by: user.id,
        name: input.name ?? 'Clients sync',
        spreadsheet_id: input.spreadsheet_id ?? '',
        sheet_name: input.sheet_name ?? 'Sheet1',
        range_a1: input.range_a1 ?? 'A1:Z1000',
        header_row: input.header_row ?? 1,
        column_mapping: input.column_mapping ?? {},
        match_field: input.match_field ?? 'name',
        frequency: input.frequency ?? 'manual',
        sync_mode: input.sync_mode ?? 'flat',
        is_active: input.is_active ?? true,
      });
      if (error) throw error;
    }
    await fetchAll();
  };

  const deleteConfig = async (id: string) => {
    const { error } = await supabase.from('client_sheet_sync_configs').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('הוגדרה הוסרה');
    await fetchAll();
  };

  const runSync = async (configId: string) => {
    setSyncing(configId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-clients-from-sheet', {
        body: { config_id: configId, triggered_by: 'manual' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      toast.success(`סונכרן: ${data.created} נוצרו, ${data.updated} עודכנו`);
      await fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error(`סנכרון נכשל: ${msg}`);
      await fetchAll();
    } finally {
      setSyncing(null);
    }
  };

  const runSyncStream = async (
    configId: string,
    onEvent: (event: SyncStreamEvent) => void,
  ) => {
    setSyncing(configId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-clients-from-sheet`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ config_id: configId, triggered_by: 'manual', stream: true }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastDone: SyncStreamEvent | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const evt = JSON.parse(line) as SyncStreamEvent;
            onEvent(evt);
            if (evt.type === 'done') lastDone = evt;
          } catch { /* ignore malformed line */ }
        }
      }

      if (lastDone?.type === 'done') {
        if (lastDone.success) {
          toast.success(`סונכרן: ${lastDone.created ?? 0} נוצרו, ${lastDone.updated ?? 0} עודכנו`);
        } else {
          toast.error(`סנכרון נכשל: ${lastDone.error ?? 'Unknown error'}`);
        }
      }
      await fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error(`סנכרון נכשל: ${msg}`);
      onEvent({ type: 'done', success: false, error: msg });
      await fetchAll();
    } finally {
      setSyncing(null);
    }
  };

  return { configs, logs, loading, syncing, fetchMetadata, upsertConfig, deleteConfig, runSync, runSyncStream, refresh: fetchAll };
}