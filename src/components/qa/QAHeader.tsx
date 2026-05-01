import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { QAPlatform } from '@/types/qa';
import { QA_PLATFORM_LABEL } from '@/data/qaChecklistData';

interface Client { id: string; name: string }

interface Props {
  clients: Client[];
  clientId: string | null;
  onClient: (id: string | null, name: string) => void;
  campaignName: string;
  onCampaignName: (s: string) => void;
  adName?: string;
  onAdName?: (s: string) => void;
  platform: QAPlatform;
  onPlatform: (p: QAPlatform) => void;
  reviewerName: string;
  readOnly?: boolean;
}

const PLATFORMS: QAPlatform[] = ['meta', 'google', 'tiktok'];

export default function QAHeader({
  clients, clientId, onClient, campaignName, onCampaignName, adName, onAdName, platform, onPlatform, reviewerName, readOnly,
}: Props) {
  return (
    <div className="grid gap-4 rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>לקוח</Label>
        <select
          dir="rtl"
          disabled={readOnly}
          value={clientId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            const name = clients.find((c) => c.id === id)?.name ?? '';
            onClient(id, name);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">בחר לקוח...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>שם קמפיין</Label>
        <Input
          dir="rtl"
          disabled={readOnly}
          value={campaignName}
          onChange={(e) => onCampaignName(e.target.value)}
          placeholder="הזן שם קמפיין..."
        />
      </div>
      {onAdName && (
        <div className="space-y-1.5 md:col-span-2">
          <Label>שם מודעה</Label>
          <Input
            dir="rtl"
            disabled={readOnly}
            value={adName ?? ''}
            onChange={(e) => onAdName(e.target.value)}
            placeholder="לדוגמה: וידאו 15 שניות — Reels"
          />
        </div>
      )}
      <div className="space-y-1.5 md:col-span-2">
        <Label>פלטפורמה</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={readOnly}
              onClick={() => onPlatform(p)}
              className={cn(
                'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                platform === p
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border/40 bg-card/40 hover:bg-card/80',
              )}
            >
              {QA_PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="text-xs text-muted-foreground md:col-span-2">
        בודק: <span className="font-medium text-foreground">{reviewerName || '—'}</span>
      </div>
    </div>
  );
}