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
  }, [fetchAll]);

  return { clients, projects, campaigns, loaded, refetch: fetchAll };
}
