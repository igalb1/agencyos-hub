import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CustomColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'formula';
  formula: string | null;
  display_order: number;
}

// Map of campaignId -> columnId -> value
export type CustomValuesMap = Record<string, Record<string, string>>;

export function useCustomColumns() {
  const { organization } = useAuth();
  const orgId = organization?.id;
  const [columns, setColumns] = useState<CustomColumn[]>([]);
  const [values, setValues] = useState<CustomValuesMap>({});
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!orgId) return;
    const [{ data: cols }, { data: vals }] = await Promise.all([
      supabase
        .from('campaign_custom_columns')
        .select('id,name,type,formula,display_order')
        .eq('organization_id', orgId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('campaign_custom_values')
        .select('campaign_id,column_id,value')
        .eq('organization_id', orgId),
    ]);
    setColumns((cols ?? []) as CustomColumn[]);
    const map: CustomValuesMap = {};
    (vals ?? []).forEach((v: any) => {
      if (!map[v.campaign_id]) map[v.campaign_id] = {};
      map[v.campaign_id][v.column_id] = v.value ?? '';
    });
    setValues(map);
    setLoaded(true);
  }, [orgId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addColumn = useCallback(async (name: string, type: 'text' | 'number' | 'formula', formula?: string | null) => {
    if (!orgId) return;
    const display_order = columns.length;
    const { error } = await supabase
      .from('campaign_custom_columns')
      .insert({ organization_id: orgId, name, type, formula: formula ?? null, display_order });
    if (error) throw error;
    await fetchAll();
  }, [orgId, columns.length, fetchAll]);

  const renameColumn = useCallback(async (id: string, name: string) => {
    const { error } = await supabase
      .from('campaign_custom_columns')
      .update({ name })
      .eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const updateFormula = useCallback(async (id: string, formula: string) => {
    const { error } = await supabase
      .from('campaign_custom_columns')
      .update({ formula })
      .eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const deleteColumn = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('campaign_custom_columns')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const setValue = useCallback(async (campaignId: string, columnId: string, value: string) => {
    if (!orgId) return;
    // upsert by (campaign_id, column_id)
    const { error } = await supabase
      .from('campaign_custom_values')
      .upsert(
        { organization_id: orgId, campaign_id: campaignId, column_id: columnId, value },
        { onConflict: 'campaign_id,column_id' }
      );
    if (error) throw error;
    setValues(prev => ({
      ...prev,
      [campaignId]: { ...(prev[campaignId] ?? {}), [columnId]: value },
    }));
  }, [orgId]);

  return { columns, values, loaded, addColumn, renameColumn, updateFormula, deleteColumn, setValue, refetch: fetchAll };
}