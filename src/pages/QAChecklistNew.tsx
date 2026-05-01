import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgData } from '@/hooks/useOrgData';
import { useQAChecklist } from '@/hooks/useQAChecklist';
import { QA_DEFAULT_SECTIONS } from '@/data/qaChecklistData';
import QAHeader from '@/components/qa/QAHeader';
import type { QAPlatform } from '@/types/qa';
import { toast } from '@/hooks/use-toast';

export default function QAChecklistNewPage() {
  const { profile, user } = useAuth();
  const { clients } = useOrgData();
  const { create } = useQAChecklist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [adName, setAdName] = useState('');
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
      const row = await create({ clientId, clientName, campaignName, adName, platform, sections: QA_DEFAULT_SECTIONS });
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
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/qa')}>ביטול</Button>
        <Button disabled={!canStart || creating} onClick={handleStart} className="gap-2">
          {creating ? 'יוצר...' : 'התחל בדיקה'} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}