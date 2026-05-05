export type Lang = 'he' | 'en';

export const translations = {
  // Nav
  dashboard: { he: 'לוח בקרה', en: 'Dashboard' },
  clients: { he: 'לקוחות', en: 'Clients' },
  projects: { he: 'פרויקטים', en: 'Projects' },
  campaigns: { he: 'קמפיינים', en: 'Campaigns' },
  ads: { he: 'מודעות', en: 'Ads' },
  timeline: { he: 'ציר זמן', en: 'Timeline' },
  tasks: { he: 'משימות', en: 'Tasks' },
  performance: { he: 'ביצועים', en: 'Performance' },
  integrations: { he: 'אינטגרציות', en: 'Integrations' },
  reports: { he: 'דוחות', en: 'Reports' },
  calendar: { he: 'לוח שנה', en: 'Calendar' },
  settings: { he: 'הגדרות', en: 'Settings' },
  qa: { he: 'בקרת איכות', en: 'QA Checklist' },
  audit: { he: 'Audit', en: 'Audit' },
  creative: { he: 'קריאייטיב', en: 'Creative' },
  // KPIs
  totalBudget: { he: 'תקציב כולל', en: 'Total Budget' },
  totalSpend: { he: 'הוצאה כוללת', en: 'Total Spend' },
  totalLeads: { he: 'לידים כולל', en: 'Total Leads' },
  avgCpl: { he: 'עלות ממוצעת לליד', en: 'Avg CPL' },
  // General
  search: { he: 'חיפוש...', en: 'Search...' },
  notifications: { he: 'התראות', en: 'Notifications' },
  comingSoon: { he: 'בקרוב', en: 'Coming Soon' },
  budget: { he: 'תקציב', en: 'Budget' },
  spend: { he: 'הוצאה', en: 'Spend' },
  leads: { he: 'לידים', en: 'Leads' },
  cpl: { he: 'עלות לליד', en: 'CPL' },
  status: { he: 'סטטוס', en: 'Status' },
  name: { he: 'שם', en: 'Name' },
  recentTasks: { he: 'משימות אחרונות', en: 'Recent Tasks' },
  topClients: { he: 'לקוחות מובילים', en: 'Top Clients' },
  budgetAlerts: { he: 'התראות תקציב', en: 'Budget Alerts' },
  spendByPlatform: { he: 'הוצאה לפי פלטפורמה', en: 'Spend by Platform' },
  leadsByClient: { he: 'לידים לפי לקוח', en: 'Leads by Client' },
  spendOverTime: { he: 'הוצאה לאורך זמן', en: 'Spend Over Time' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}
