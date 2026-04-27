export interface Client {
  id: string;
  name: string;
  industry: string;
  color: string;
  budget: number;
  spend: number;
  leads: number;
  status: 'active' | 'paused';
}

export interface Campaign {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  name: string;
  platform: 'Meta' | 'Google' | 'TikTok' | 'LinkedIn';
  status: 'Live' | 'Planned' | 'Paused';
  objective: 'leads' | 'sales' | 'video' | 'awareness' | 'traffic' | 'engagement' | 'app' | 'other';
  budget: number;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: string;
  endDate: string;
  budgetAlertThreshold: number;
}

export interface Ad {
  id: string;
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  projectId: string;
  name: string;
  platform: 'Meta' | 'Google' | 'TikTok' | 'LinkedIn';
  status: 'Active' | 'Paused' | 'Rejected' | 'Draft';
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  mediaType: 'image' | 'video';
  mediaUrl?: string;
}

export interface Project {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  status: 'active' | 'planning' | 'completed';
  budget: number;
  spend: number;
  campaigns: number;
  startDate: string;
  endDate: string;
}

export type Platform = 'Meta' | 'Google' | 'TikTok' | 'LinkedIn';
export type CampaignStatus = 'Live' | 'Planned' | 'Paused';
