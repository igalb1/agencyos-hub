import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/hooks/useOrgData';
import { useQAChecklist } from '@/hooks/useQAChecklist';
import { QA_DEFAULT_SECTIONS } from '@/data/qaChecklistData';
import QAHeader from '@/components/qa/QAHeader';
import type { QAPlatform, CampaignAdRow } from '@/types/qa';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function QAChecklistNewPage() {
  const { profile, user, organization } = useAuth();
  const { clients } = useOrgData();
  const { create } = useQAChecklist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [adName, setAdName] = useState('');
  const [selectedAdId, setSelectedAdId] = useState<string>('');
  const [existingAds, setExistingAds] = useState<CampaignAdRow[]>([]);
  const [matchedCampaignId, setMatchedCampaignId] = useState<string | null>(null);
  const [platform, setPlatform] = useState<QAPlatform>('meta');
  const [creating, setCreating] = useState(false);

  // Pre-fill from duplicate
  useEffect(() => {
    const raw = sessionStorage.getItem('qa_duplicate');
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d.clientId) setClientId(d.clientId);
        if (d.clientName) setClientName(d.clientName);
        if (d.campaignName) setCampaignName(d.campaignName);
        if (d.adName) setAdName(d.adName + ' (עותק)');
        if (d.platform) setPlatform(d.platform);
      } catch {}
      sessionStorage.removeItem('qa_duplicate');
      return;
    }
    // Pre-fill from URL (e.g. linked from Campaigns table)
    const qName = searchParams.get('name');
    const qClient = searchParams.get('client');
    const qClientName = searchParams.get('clientName');
    const qAd = searchParams.get('ad');
    const qPlatform = searchParams.get('platform') as QAPlatform | null;
    if (qName) setCampaignName(qName);
    if (qClient) setClientId(qClient);
    if (qClientName) setClientName(qClientName);
    if (qAd) setAdName(qAd);
    if (qPlatform && ['meta', 'google', 'tiktok'].includes(qPlatform)) setPlatform(qPlatform);
  }, []);

  // Look up matching campaign + load its ads when campaign/client are set
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!organization?.id || !campaignName.trim()) {
        setExistingAds([]); setMatchedCampaignId(null); return;
      }
      let q = supabase
        .from('campaigns')
        .select('id')
        .eq('organization_id', organization.id)
        .eq('name', campaignName.trim())
        .limit(1);
      if (clientId) q = q.eq('client_id', clientId);
      const { data: camps } = await q;
      const cid = camps?.[0]?.id ?? null;
      if (cancelled) return;
      setMatchedCampaignId(cid);
      if (!cid) { setExistingAds([]); return; }
      const { data: ads } = await (supabase as any)
        .from('campaign_ads')
        .select('*')
        .eq('campaign_id', cid)
        .order('created_at', { ascending: false });
      if (!cancelled) setExistingAds((ads as CampaignAdRow[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [organization?.id, campaignName, clientId]);

  const reviewerName = profile?.full_name || user?.email || '';
  const clientOptions = useMemo(() => clients.map((c) => ({ id: c.id, name: c.name })), [clients]);
  const canStart =
    clientName.trim().length > 0 &&
    campaignName.trim().length > 0 &&
    adName.trim().length > 0;

  const handleStart = async () => {
    if (!canStart) return;
    setCreating(true);
    try {
      const row = await create({
        clientId,
        clientName,
        campaignName,
        adName,
        adId: selectedAdId || null,
        platform,
        sections: QA_DEFAULT_SECTIONS,
      });
      navigate(`/qa/${row.id}`);
    } catch (e: any) {
      toast({ title: 'שגיאה ביצירת בדיקה', description: e.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="font-rubik mx-auto max-w-3xl space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">בדיקת QA חדשה</h1>
        <p className="text-sm text-muted-foreground">בדיקה ברמת מודעה — מלא פרטי קמפיין ומודעה כדי להתחיל</p>
      </div>
      <QAHeader
        clients={clientOptions}
        clientId={clientId}
        onClient={(id, name) => { setClientId(id); setClientName(name); }}
        campaignName={campaignName}
        onCampaignName={setCampaignName}
        adName={adName}
        onAdName={setAdName}
        platform={platform}
        onPlatform={setPlatform}
        reviewerName={reviewerName}
      />
      {matchedCampaignId && existingAds.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
          <Label>בחר מודעה קיימת מהקמפיין</Label>
          <select
            dir="rtl"
            value={selectedAdId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedAdId(id);
              const ad = existingAds.find((a) => a.id === id);
              if (ad) setAdName(ad.name);
            }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">— מודעה חדשה (לפי השם שהוזן למעלה) —</option>
            {existingAds.map((ad) => (
              <option key={ad.id} value={ad.id}>
                {ad.name} {ad.status ? `· ${ad.status}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            אם תבחר מודעה קיימת, הבדיקה תקושר אליה. אחרת — תיווצר מודעה חדשה בקמפיין.
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/qa')}>ביטול</Button>
        <Button disabled={!canStart || creating} onClick={handleStart} className="gap-2">
          {creating ? 'יוצר...' : 'התחל בדיקה'} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}