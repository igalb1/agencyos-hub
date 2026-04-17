import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Client, Project, Campaign, Platform, CampaignStatus } from '@/lib/types';

const DEFAULT_COLORS = ['#00D4FF', '#22C55E', '#A78BFA', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

function colorFor(i: number) {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

export function useOrgData() {
  const { organization } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!organization?.id) return;
    const orgId = organization.id;

    const [{ data: cRows }, { data: pRows }, { data: campRows }] = await Promise.all([
      supabase.from('clients').select('*').eq('organization_id', orgId).order('created_at', { ascending: true }),
      supabase.from('projects').select('*').eq('organization_id', orgId).order('created_at', { ascending: true }),
      supabase.from('campaigns').select('*').eq('organization_id', orgId).order('created_at', { ascending: true }),
    ]);

    const clientMap = new Map<string, { name: string; color: string }>();
    const mappedClients: Client[] = (cRows ?? []).map((c, i) => {
      const color = c.color || colorFor(i);
      clientMap.set(c.id, { name: c.name, color });
      return {
        id: c.id,
        name: c.name,
        industry: c.industry ?? '',
        color,
        budget: Number(c.budget ?? 0),
        spend: Number(c.spend ?? 0),
        leads: c.leads ?? 0,
        status: (c.status === 'paused' ? 'paused' : 'active') as 'active' | 'paused',
      };
    });

    const projectMap = new Map<string, string>();
    const campaignCounts = new Map<string, number>();
    (campRows ?? []).forEach((c) => {
      if (c.project_id) campaignCounts.set(c.project_id, (campaignCounts.get(c.project_id) ?? 0) + 1);
    });

    const mappedProjects: Project[] = (pRows ?? []).map((p) => {
      projectMap.set(p.id, p.name);
      const client = p.client_id ? clientMap.get(p.client_id) : undefined;
      return {
        id: p.id,
        clientId: p.client_id ?? '',
        clientName: client?.name ?? '',
        name: p.name,
        status: (['active', 'planning', 'completed'].includes(p.status) ? p.status : 'active') as Project['status'],
        budget: Number(p.budget ?? 0),
        spend: Number(p.spend ?? 0),
        campaigns: campaignCounts.get(p.id) ?? 0,
        startDate: p.start_date ?? '',
        endDate: p.end_date ?? '',
      };
    });

    const mappedCampaigns: Campaign[] = (campRows ?? []).map((c) => {
      const client = c.client_id ? clientMap.get(c.client_id) : undefined;
      const platform = (['Meta', 'Google', 'TikTok', 'LinkedIn'].includes(c.platform ?? '') ? c.platform : 'Meta') as Platform;
      const status = (['Live', 'Planned', 'Paused'].includes(c.status) ? c.status : 'Planned') as CampaignStatus;
      return {
        id: c.id,
        clientId: c.client_id ?? '',
        clientName: client?.name ?? '',
        projectId: c.project_id ?? '',
        projectName: c.project_id ? projectMap.get(c.project_id) ?? '' : '',
        name: c.name,
        platform,
        status,
        budget: Number(c.budget ?? 0),
        spend: Number(c.spend ?? 0),
        leads: c.leads ?? 0,
        impressions: c.impressions ?? 0,
        clicks: c.clicks ?? 0,
        conversions: c.conversions ?? 0,
        startDate: c.start_date ?? '',
        endDate: c.end_date ?? '',
        budgetAlertThreshold: Number(c.budget_alert_threshold ?? 80),
      };
    });

    setClients(mappedClients);
    setProjects(mappedProjects);
    setCampaigns(mappedCampaigns);
    setLoaded(true);
  }, [organization?.id]);

  useEffect(() => {
    fetchAll();
    const handler = () => fetchAll();
    window.addEventListener('orgdata:refresh', handler);
    return () => window.removeEventListener('orgdata:refresh', handler);
  }, [fetchAll]);

  // ====== Mutations ======
  const orgId = organization?.id;

  // Clients
  const upsertClient = useCallback(async (client: Client): Promise<Client | null> => {
    if (!orgId) return null;
    const payload = {
      organization_id: orgId,
      name: client.name,
      industry: client.industry || null,
      color: client.color || null,
      budget: client.budget,
      spend: client.spend,
      leads: client.leads,
      status: client.status,
    };
    if (client.id) {
      const { error } = await supabase.from('clients').update(payload).eq('id', client.id);
      if (error) throw error;
      await fetchAll();
      return client;
    }
    const { data, error } = await supabase.from('clients').insert(payload).select('id').single();
    if (error) throw error;
    await fetchAll();
    return { ...client, id: data!.id };
  }, [orgId, fetchAll]);

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Projects
  const upsertProject = useCallback(async (project: Project): Promise<Project | null> => {
    if (!orgId) return null;
    const payload = {
      organization_id: orgId,
      client_id: project.clientId || null,
      name: project.name,
      status: project.status,
      budget: project.budget,
      spend: project.spend,
      start_date: project.startDate || null,
      end_date: project.endDate || null,
    };
    if (project.id) {
      const { error } = await supabase.from('projects').update(payload).eq('id', project.id);
      if (error) throw error;
      await fetchAll();
      return project;
    }
    const { data, error } = await supabase.from('projects').insert(payload).select('id').single();
    if (error) throw error;
    await fetchAll();
    return { ...project, id: data!.id };
  }, [orgId, fetchAll]);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  // Campaigns
  const upsertCampaign = useCallback(async (campaign: Campaign): Promise<Campaign | null> => {
    if (!orgId) return null;
    const payload = {
      organization_id: orgId,
      client_id: campaign.clientId || null,
      project_id: campaign.projectId || null,
      name: campaign.name,
      platform: campaign.platform,
      status: campaign.status,
      budget: campaign.budget,
      spend: campaign.spend,
      leads: campaign.leads,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      start_date: campaign.startDate || null,
      end_date: campaign.endDate || null,
      budget_alert_threshold: campaign.budgetAlertThreshold,
    };
    const isExisting = campaign.id && !campaign.id.startsWith('new-');
    if (isExisting) {
      const { error } = await supabase.from('campaigns').update(payload).eq('id', campaign.id);
      if (error) throw error;
      await fetchAll();
      return campaign;
    }
    const { data, error } = await supabase.from('campaigns').insert(payload).select('id').single();
    if (error) throw error;
    await fetchAll();
    return { ...campaign, id: data!.id };
  }, [orgId, fetchAll]);

  const updateCampaignField = useCallback(async (id: string, field: string, value: number | string) => {
    const dbFieldMap: Record<string, string> = {
      startDate: 'start_date',
      endDate: 'end_date',
      budgetAlertThreshold: 'budget_alert_threshold',
      clientId: 'client_id',
      projectId: 'project_id',
    };
    const dbField = dbFieldMap[field] ?? field;
    const { error } = await supabase.from('campaigns').update({ [dbField]: value }).eq('id', id);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  const deleteCampaigns = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase.from('campaigns').delete().in('id', ids);
    if (error) throw error;
    await fetchAll();
  }, [fetchAll]);

  return {
    clients, projects, campaigns, loaded,
    refetch: fetchAll,
    upsertClient, deleteClient,
    upsertProject, deleteProject,
    upsertCampaign, updateCampaignField, deleteCampaigns,
  };
}
