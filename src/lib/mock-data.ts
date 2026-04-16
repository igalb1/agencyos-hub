export const mockClients = [
  { id: '1', name: 'TechFlow', industry: 'SaaS', color: '#00D4FF', budget: 50000, spend: 32000, leads: 420, status: 'active' as const },
  { id: '2', name: 'GreenLeaf', industry: 'E-Commerce', color: '#22C55E', budget: 35000, spend: 28000, leads: 310, status: 'active' as const },
  { id: '3', name: 'UrbanFit', industry: 'Health', color: '#A78BFA', budget: 25000, spend: 18500, leads: 195, status: 'active' as const },
  { id: '4', name: 'SkyMedia', industry: 'Media', color: '#F59E0B', budget: 40000, spend: 15000, leads: 88, status: 'paused' as const },
  { id: '5', name: 'DataPulse', industry: 'Analytics', color: '#EF4444', budget: 60000, spend: 45000, leads: 530, status: 'active' as const },
];

export const mockCampaigns = [
  { id: '1', clientId: '1', clientName: 'TechFlow', name: 'Brand Awareness Q1', platform: 'Meta' as const, status: 'Live' as const, budget: 15000, spend: 12500, leads: 180, startDate: '2026-01-01', endDate: '2026-03-31' },
  { id: '2', clientId: '1', clientName: 'TechFlow', name: 'Google Search', platform: 'Google' as const, status: 'Live' as const, budget: 20000, spend: 14000, leads: 240, startDate: '2026-02-01', endDate: '2026-04-30' },
  { id: '3', clientId: '2', clientName: 'GreenLeaf', name: 'Summer Sale', platform: 'Meta' as const, status: 'Planned' as const, budget: 10000, spend: 0, leads: 0, startDate: '2026-05-01', endDate: '2026-06-30' },
  { id: '4', clientId: '3', clientName: 'UrbanFit', name: 'App Install', platform: 'TikTok' as const, status: 'Live' as const, budget: 12000, spend: 9800, leads: 95, startDate: '2026-03-01', endDate: '2026-04-30' },
  { id: '5', clientId: '5', clientName: 'DataPulse', name: 'LinkedIn B2B', platform: 'LinkedIn' as const, status: 'Live' as const, budget: 25000, spend: 21000, leads: 310, startDate: '2026-01-15', endDate: '2026-06-15' },
];

export const mockTasks = [
  { id: '1', title: 'עדכון קריאייטיב לקמפיין Meta', clientName: 'TechFlow', assignee: 'דנה', status: 'To Do' as const, priority: 'High' as const, due: '2026-04-18' },
  { id: '2', title: 'הכנת דוח חודשי', clientName: 'GreenLeaf', assignee: 'יוסי', status: 'In Progress' as const, priority: 'Medium' as const, due: '2026-04-20' },
  { id: '3', title: 'בדיקת תקציב Google Ads', clientName: 'DataPulse', assignee: 'מיכל', status: 'Done' as const, priority: 'Low' as const, due: '2026-04-15' },
  { id: '4', title: 'השקת קמפיין TikTok חדש', clientName: 'UrbanFit', assignee: 'דנה', status: 'To Do' as const, priority: 'High' as const, due: '2026-04-22' },
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
