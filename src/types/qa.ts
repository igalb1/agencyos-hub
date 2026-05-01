export type QAPriority = 'critical' | 'high' | 'medium';
export type QAPlatform = 'meta' | 'google' | 'tiktok';
export type QAStatus = 'in_progress' | 'approved' | 'rejected';
export type QAScope = 'campaign' | 'ad';
export type QASectionScope = 'campaign' | 'ad';

export interface QAItemDef {
  id: string;
  text: string;
  priority: QAPriority;
}

export interface QASectionDef {
  id: string;
  title: string;
  icon: string;
  colorVar: string; // CSS var name e.g. 'qa-creative'
  scope?: QASectionScope; // 'campaign' = checked once for the whole campaign, 'ad' = per-ad
  items: QAItemDef[];
}

export interface QAChecklistRow {
  id: string;
  organization_id: string;
  client_id: string | null;
  client_name: string;
  campaign_name: string;
  ad_id: string | null;
  ad_name: string | null;
  scope: QAScope;
  platform: QAPlatform;
  template_id: string | null;
  template_snapshot: QASectionDef[];
  checked_items: Record<string, boolean>;
  notes: Record<string, string>;
  status: QAStatus;
  progress: number;
  critical_complete: boolean;
  created_by: string;
  created_by_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignAdRow {
  id: string;
  organization_id: string;
  campaign_id: string;
  name: string;
  format: string | null;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QATemplateRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  sections: QASectionDef[];
  created_by: string;
  created_at: string;
  updated_at: string;
}