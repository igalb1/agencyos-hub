import { Platform, CampaignStatus } from './types';

export function getPlatformColor(platform: Platform): string {
  const colors: Record<Platform, string> = {
    Meta: '#1877F2',
    Google: '#EA4335',
    TikTok: '#010101',
    LinkedIn: '#0A66C2',
  };
  return colors[platform];
}

export function getPlatformLabel(platform: Platform): string {
  return platform;
}

export function getStatusColor(status: CampaignStatus): { bg: string; text: string } {
  switch (status) {
    case 'Live': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' };
    case 'Planned': return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
    case 'Paused': return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
  }
}

export function getAdStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'Active': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' };
    case 'Paused': return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
    case 'Rejected': return { bg: 'bg-red-500/15', text: 'text-red-400' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

export interface PaceInfo {
  label: string;
  labelHe: string;
  pct: number;
  color: string;
  bgColor: string;
}

export function calcPacing(spend: number, budget: number, startDate: string, endDate: string): PaceInfo {
  if (budget <= 0) return { label: 'N/A', labelHe: 'לא זמין', pct: 0, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const totalDays = Math.max((end - start) / 86400000, 1);
  const elapsed = Math.max(Math.min((now - start) / 86400000, totalDays), 0);
  const dailyBudget = budget / totalDays;
  const expectedSpend = dailyBudget * elapsed;
  if (expectedSpend <= 0) return { label: 'Not Started', labelHe: 'טרם החל', pct: 0, color: 'text-muted-foreground', bgColor: 'bg-muted' };
  const pct = Math.round((spend / expectedSpend) * 100);
  if (pct >= 85 && pct <= 115) return { label: 'On Pace', labelHe: 'בקצב', pct, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15' };
  if (pct < 85) return { label: 'Under', labelHe: 'מתחת', pct, color: 'text-blue-400', bgColor: 'bg-blue-500/15' };
  return { label: 'Over', labelHe: 'מעל', pct, color: 'text-amber-400', bgColor: 'bg-amber-500/15' };
}

export function fmtNum(n: number): string {
  return n.toLocaleString();
}

export function fmtCurrency(n: number): string {
  return `₪${n.toLocaleString()}`;
}

export function calcCtr(clicks: number, impressions: number): string {
  if (impressions <= 0) return '0%';
  return ((clicks / impressions) * 100).toFixed(2) + '%';
}

export function calcCpl(spend: number, leads: number): string {
  if (leads <= 0) return '—';
  return fmtCurrency(Math.round(spend / leads));
}
