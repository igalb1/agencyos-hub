import { Client, Campaign, Ad, Project } from './types';

export const mockClients: Client[] = [
  { id: '1', name: 'TechFlow', industry: 'SaaS', color: '#00D4FF', budget: 50000, spend: 32000, leads: 420, status: 'active' },
  { id: '2', name: 'GreenLeaf', industry: 'E-Commerce', color: '#22C55E', budget: 35000, spend: 28000, leads: 310, status: 'active' },
  { id: '3', name: 'UrbanFit', industry: 'Health', color: '#A78BFA', budget: 25000, spend: 18500, leads: 195, status: 'active' },
  { id: '4', name: 'SkyMedia', industry: 'Media', color: '#F59E0B', budget: 40000, spend: 15000, leads: 88, status: 'paused' },
  { id: '5', name: 'DataPulse', industry: 'Analytics', color: '#EF4444', budget: 60000, spend: 45000, leads: 530, status: 'active' },
];

export const mockProjects: Project[] = [
  { id: 'p1', clientId: '1', clientName: 'TechFlow', name: 'Brand Launch', status: 'active', budget: 43000, spend: 29700, campaigns: 3, startDate: '2026-01-01', endDate: '2026-04-30' },
  { id: 'p2', clientId: '1', clientName: 'TechFlow', name: 'Product Hunt', status: 'active', budget: 8000, spend: 3200, campaigns: 1, startDate: '2026-03-01', endDate: '2026-04-15' },
  { id: 'p3', clientId: '2', clientName: 'GreenLeaf', name: 'Summer Sale 2026', status: 'planning', budget: 22000, spend: 9800, campaigns: 2, startDate: '2026-03-15', endDate: '2026-06-30' },
  { id: 'p4', clientId: '3', clientName: 'UrbanFit', name: 'App Install Q2', status: 'active', budget: 18000, spend: 14000, campaigns: 2, startDate: '2026-03-01', endDate: '2026-05-15' },
  { id: 'p5', clientId: '5', clientName: 'DataPulse', name: 'B2B Outreach', status: 'active', budget: 43000, spend: 34500, campaigns: 2, startDate: '2026-01-15', endDate: '2026-06-15' },
];

export const mockCampaigns: Campaign[] = [
  { id: '1', clientId: '1', clientName: 'TechFlow', projectId: 'p1', projectName: 'Brand Launch', name: 'Brand Awareness Q1', platform: 'Meta', status: 'Live', budget: 15000, spend: 12500, leads: 180, impressions: 520000, clicks: 8400, conversions: 95, startDate: '2026-01-01', endDate: '2026-03-31', budgetAlertThreshold: 80 },
  { id: '2', clientId: '1', clientName: 'TechFlow', projectId: 'p1', projectName: 'Brand Launch', name: 'Google Search SaaS', platform: 'Google', status: 'Live', budget: 20000, spend: 14000, leads: 240, impressions: 310000, clicks: 12500, conversions: 160, startDate: '2026-02-01', endDate: '2026-04-30', budgetAlertThreshold: 85 },
  { id: '3', clientId: '1', clientName: 'TechFlow', projectId: 'p2', projectName: 'Product Hunt', name: 'TikTok Viral Push', platform: 'TikTok', status: 'Paused', budget: 8000, spend: 3200, leads: 45, impressions: 890000, clicks: 22000, conversions: 30, startDate: '2026-03-01', endDate: '2026-04-15', budgetAlertThreshold: 90 },
  { id: '4', clientId: '2', clientName: 'GreenLeaf', projectId: 'p3', projectName: 'Summer Sale 2026', name: 'Summer Sale Meta', platform: 'Meta', status: 'Planned', budget: 10000, spend: 0, leads: 0, impressions: 0, clicks: 0, conversions: 0, startDate: '2026-05-01', endDate: '2026-06-30', budgetAlertThreshold: 80 },
  { id: '5', clientId: '2', clientName: 'GreenLeaf', projectId: 'p3', projectName: 'Summer Sale 2026', name: 'Google Shopping', platform: 'Google', status: 'Live', budget: 12000, spend: 9800, leads: 190, impressions: 180000, clicks: 7200, conversions: 120, startDate: '2026-03-15', endDate: '2026-05-31', budgetAlertThreshold: 80 },
  { id: '6', clientId: '3', clientName: 'UrbanFit', projectId: 'p4', projectName: 'App Install Q2', name: 'App Install TikTok', platform: 'TikTok', status: 'Live', budget: 12000, spend: 9800, leads: 95, impressions: 1200000, clicks: 34000, conversions: 65, startDate: '2026-03-01', endDate: '2026-04-30', budgetAlertThreshold: 75 },
  { id: '7', clientId: '3', clientName: 'UrbanFit', projectId: 'p4', projectName: 'App Install Q2', name: 'Meta Retargeting', platform: 'Meta', status: 'Live', budget: 6000, spend: 4200, leads: 58, impressions: 95000, clicks: 3800, conversions: 42, startDate: '2026-03-15', endDate: '2026-05-15', budgetAlertThreshold: 80 },
  { id: '8', clientId: '5', clientName: 'DataPulse', projectId: 'p5', projectName: 'B2B Outreach', name: 'LinkedIn B2B Leads', platform: 'LinkedIn', status: 'Live', budget: 25000, spend: 21000, leads: 310, impressions: 145000, clicks: 5800, conversions: 210, startDate: '2026-01-15', endDate: '2026-06-15', budgetAlertThreshold: 80 },
  { id: '9', clientId: '5', clientName: 'DataPulse', projectId: 'p5', projectName: 'B2B Outreach', name: 'Google Display Network', platform: 'Google', status: 'Live', budget: 18000, spend: 13500, leads: 120, impressions: 420000, clicks: 9200, conversions: 78, startDate: '2026-02-01', endDate: '2026-05-31', budgetAlertThreshold: 85 },
];

export const mockAds: Ad[] = [
  { id: 'a1', campaignId: '1', campaignName: 'Brand Awareness Q1', clientId: '1', clientName: 'TechFlow', projectId: 'p1', name: 'Hero Video 30s', platform: 'Meta', status: 'Active', spend: 5200, impressions: 220000, clicks: 3600, leads: 82, conversions: 45, mediaType: 'video', mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop' },
  { id: 'a2', campaignId: '1', campaignName: 'Brand Awareness Q1', clientId: '1', clientName: 'TechFlow', projectId: 'p1', name: 'Carousel Products', platform: 'Meta', status: 'Active', spend: 4100, impressions: 180000, clicks: 2900, leads: 58, conversions: 30, mediaType: 'image', mediaUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=300&fit=crop' },
  { id: 'a3', campaignId: '1', campaignName: 'Brand Awareness Q1', clientId: '1', clientName: 'TechFlow', projectId: 'p1', name: 'Story Ad - CTA', platform: 'Meta', status: 'Paused', spend: 3200, impressions: 120000, clicks: 1900, leads: 40, conversions: 20, mediaType: 'video', mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop' },
  { id: 'a4', campaignId: '2', campaignName: 'Google Search SaaS', clientId: '1', clientName: 'TechFlow', projectId: 'p1', name: 'RSA - Main Keywords', platform: 'Google', status: 'Active', spend: 8500, impressions: 195000, clicks: 7800, leads: 150, conversions: 100, mediaType: 'image', mediaUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=300&fit=crop' },
  { id: 'a5', campaignId: '2', campaignName: 'Google Search SaaS', clientId: '1', clientName: 'TechFlow', projectId: 'p1', name: 'RSA - Brand Terms', platform: 'Google', status: 'Active', spend: 5500, impressions: 115000, clicks: 4700, leads: 90, conversions: 60, mediaType: 'image', mediaUrl: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400&h=300&fit=crop' },
  { id: 'a6', campaignId: '6', campaignName: 'App Install TikTok', clientId: '3', clientName: 'UrbanFit', projectId: 'p4', name: 'Gym Motivation Reel', platform: 'TikTok', status: 'Active', spend: 5400, impressions: 680000, clicks: 19000, leads: 52, conversions: 35, mediaType: 'video', mediaUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=300&fit=crop' },
  { id: 'a7', campaignId: '6', campaignName: 'App Install TikTok', clientId: '3', clientName: 'UrbanFit', projectId: 'p4', name: 'Before/After UGC', platform: 'TikTok', status: 'Active', spend: 4400, impressions: 520000, clicks: 15000, leads: 43, conversions: 30, mediaType: 'video', mediaUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop' },
  { id: 'a8', campaignId: '8', campaignName: 'LinkedIn B2B Leads', clientId: '5', clientName: 'DataPulse', projectId: 'p5', name: 'Whitepaper Lead Gen', platform: 'LinkedIn', status: 'Active', spend: 12000, impressions: 82000, clicks: 3200, leads: 180, conversions: 120, mediaType: 'image', mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop' },
  { id: 'a9', campaignId: '8', campaignName: 'LinkedIn B2B Leads', clientId: '5', clientName: 'DataPulse', projectId: 'p5', name: 'Case Study Carousel', platform: 'LinkedIn', status: 'Active', spend: 9000, impressions: 63000, clicks: 2600, leads: 130, conversions: 90, mediaType: 'image', mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop' },
];

export const mockSpendByPlatform = [
  { name: 'Meta', value: 41000, color: '#1877F2' },
  { name: 'Google', value: 35000, color: '#EA4335' },
  { name: 'TikTok', value: 9800, color: '#000000' },
  { name: 'LinkedIn', value: 21000, color: '#0A66C2' },
];

export const mockSpendOverTime = [
  { month: 'ינו', spend: 18000 },
  { month: 'פבר', spend: 24000 },
  { month: 'מרץ', spend: 31000 },
  { month: 'אפר', spend: 38500 },
];

export const mockBudgetAlerts = [
  { id: '1', campaignName: 'Brand Awareness Q1', clientName: 'TechFlow', spend: 12500, budget: 15000, threshold: 80, type: 'budget_warning' as const },
  { id: '2', campaignName: 'LinkedIn B2B', clientName: 'DataPulse', spend: 21000, budget: 25000, threshold: 80, type: 'budget_warning' as const },
];

export const mockTasks = [
  { id: '1', title: 'עדכון קריאייטיב לקמפיין Meta', clientName: 'TechFlow', assignee: 'דנה', status: 'To Do' as const, priority: 'High' as const, due: '2026-04-18' },
  { id: '2', title: 'הכנת דוח חודשי', clientName: 'GreenLeaf', assignee: 'יוסי', status: 'In Progress' as const, priority: 'Medium' as const, due: '2026-04-20' },
  { id: '3', title: 'בדיקת תקציב Google Ads', clientName: 'DataPulse', assignee: 'מיכל', status: 'Done' as const, priority: 'Low' as const, due: '2026-04-15' },
  { id: '4', title: 'השקת קמפיין TikTok חדש', clientName: 'UrbanFit', assignee: 'דנה', status: 'To Do' as const, priority: 'High' as const, due: '2026-04-22' },
];
