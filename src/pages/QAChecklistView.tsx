import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQAChecklist } from '@/hooks/useQAChecklist';
import QAHeader from '@/components/qa/QAHeader';
import QAProgressBar from '@/components/qa/QAProgressBar';
import QAFilters, { type QAFilterValue } from '@/components/qa/QAFilters';
import QASection from '@/components/qa/QASection';
import QASubmitButton from '@/components/qa/QASubmitButton';
import QASuccessScreen from '@/components/qa/QASuccessScreen';
import { computeProgress } from '@/data/qaChecklistData';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function QAChecklistViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { row, loading, toggleItem, setNote, approve } = useQAChecklist({ id });
  const { profile, user } = useAuth();
  const [filter, setFilter] = useState<QAFilterValue>('all');
  const [approving, setApproving] = useState(false);

  const stats = useMemo(
    () => (row ? computeProgress(row.template_snapshot, row.checked_items) : null),
    [row],
  );

  if (loading || !row) {
    return <div className="p-8 text-center text-muted-foreground" dir="rtl">טוען בדיקה...</div>;
  }

  const readOnly = row.status === 'approved';
  const reviewerName = row.created_by_name || profile?.full_name || user?.email || '';

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approve();
      toast({ title: 'הבדיקה אושרה!', description: 'הקמפיין מוכן לאוויר.' });
    } catch (e: any) {
      toast({ title: 'שגיאה באישור', description: e.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="font-rubik mx-auto max-w-5xl space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/qa')} className="gap-1">
          <ArrowRight className="h-4 w-4 rtl:rotate-180" /> חזרה להיסטוריה
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            sessionStorage.setItem(
              'qa_duplicate',
              JSON.stringify({
                campaignName: row.campaign_name + ' (עותק)',
                clientId: row.client_id,
                clientName: row.client_name,
                platform: row.platform,
              }),
            );
            navigate('/qa/new');
          }}
        >
          <Copy className="h-4 w-4" /> שכפל בדיקה
        </Button>
      </div>

      {row.status === 'approved' && (
        <QASuccessScreen campaignName={row.campaign_name} clientName={row.client_name} />
      )}

      <QAHeader
        clients={[]}
        clientId={row.client_id}
        onClient={() => {}}
        campaignName={row.campaign_name}
        onCampaignName={() => {}}
        platform={row.platform}
        onPlatform={() => {}}
        reviewerName={reviewerName}
        readOnly
      />

      {stats && (
        <QAProgressBar
          progress={stats.progress}
          done={stats.done}
          total={stats.total}
          criticalDone={stats.criticalDone}
          criticalTotal={stats.criticalTotal}
        />
      )}

      <QAFilters value={filter} onChange={setFilter} />

      <div className="space-y-3">
        {row.template_snapshot.map((section) => (
          <QASection
            key={section.id}
            section={section}
            checked={row.checked_items}
            notes={row.notes}
            filter={filter}
            readOnly={readOnly}
            onToggle={(item) => toggleItem(item.id, item.priority === 'critical')}
            onNoteChange={(item, note) => setNote(item.id, note)}
          />
        ))}
      </div>

      {row.status !== 'approved' && stats && (
        <QASubmitButton
          criticalDone={stats.criticalDone}
          criticalTotal={stats.criticalTotal}
          onApprove={handleApprove}
          approving={approving}
        />
      )}
    </div>
  );
}