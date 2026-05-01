import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignQAStatus } from '@/hooks/useCampaignQAStatus';

interface Props {
  qa?: CampaignQAStatus;
  campaignName: string;
  clientId?: string | null;
  clientName?: string;
  platform?: string;
  lang: 'he' | 'en';
}

const STATUS_STYLE: Record<string, { dot: string; text: string; bg: string; labelHe: string; labelEn: string; Icon: any }> = {
  approved:    { dot: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10', labelHe: 'עבר',   labelEn: 'Passed',   Icon: ShieldCheck },
  rejected:    { dot: 'bg-destructive', text: 'text-destructive', bg: 'bg-destructive/10', labelHe: 'נכשל',  labelEn: 'Failed',   Icon: ShieldAlert },
  in_progress: { dot: 'bg-amber-500',   text: 'text-amber-500',   bg: 'bg-amber-500/10',   labelHe: 'בתהליך', labelEn: 'In progress', Icon: ShieldQuestion },
  mixed:       { dot: 'bg-primary',     text: 'text-primary',     bg: 'bg-primary/10',     labelHe: 'חלקי',  labelEn: 'Partial',  Icon: ShieldQuestion },
};

export default function QAStatusCell({ qa, campaignName, clientId, clientName, platform, lang }: Props) {
  const isRtl = lang === 'he';
  if (!qa) {
    const params = new URLSearchParams();
    if (campaignName) params.set('name', campaignName);
    if (clientId) params.set('client', clientId);
    if (clientName) params.set('clientName', clientName);
    if (platform) params.set('platform', platform.toLowerCase());
    return (
      <Link
        to={`/qa/new?${params.toString()}`}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        title={isRtl ? 'אין בדיקת QA — צור חדשה' : 'No QA — start one'}
      >
        <Plus size={11} />
        {isRtl ? 'בדיקה' : 'QA'}
      </Link>
    );
  }
  const s = STATUS_STYLE[qa.status] ?? STATUS_STYLE.in_progress;
  const Icon = s.Icon;
  const pct = Math.max(0, Math.min(100, qa.progress));
  const adsLabel = isRtl
    ? `${qa.ads_approved}/${qa.ads_total} מודעות עברו`
    : `${qa.ads_approved}/${qa.ads_total} ads passed`;
  return (
    <Link
      to={`/qa/${qa.latest_id}`}
      onClick={e => e.stopPropagation()}
      className="flex flex-col items-stretch gap-1 group"
      title={adsLabel}
    >
      <div className={cn('flex items-center justify-between gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium', s.bg, s.text)}>
        <span className="inline-flex items-center gap-1">
          <Icon size={11} />
          {isRtl ? s.labelHe : s.labelEn}
        </span>
        <span className="tabular-nums opacity-80">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full transition-all', s.dot)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground tabular-nums truncate">{adsLabel}</p>
    </Link>
  );
}