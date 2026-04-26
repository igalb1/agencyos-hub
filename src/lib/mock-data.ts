import { Client, Campaign, Ad, Project } from './types';

// SECURITY: All demo data removed. These exports remain as empty arrays so
// pages that still reference them compile, but no cross-tenant data leaks.
// All real data must come from useOrgData() / useTasks() scoped to the org.

export const mockClients: Client[] = [];
export const mockProjects: Project[] = [];
export const mockCampaigns: Campaign[] = [];
export const mockAds: Ad[] = [];

export const mockSpendByPlatform: { name: string; value: number; color: string }[] = [];
export const mockSpendOverTime: { month: string; spend: number }[] = [];
export const mockBudgetAlerts: {
  id: string; campaignName: string; clientName: string;
  spend: number; budget: number; threshold: number;
  type: 'budget_warning';
}[] = [];
export const mockTasks: {
  id: string; title: string; clientName: string; assignee: string;
  status: 'To Do' | 'In Progress' | 'Done';
  priority: 'High' | 'Medium' | 'Low';
  due: string;
}[] = [];
