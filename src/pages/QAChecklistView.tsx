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
import CreateTaskFromQADialog from '@/components/qa/CreateTaskFromQADialog';
import type { QAItemDef } from '@/types/qa';

export default function QAChecklistViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { row, loading, toggleItem, setNote, approve, reject } = useQAChecklist({ id });
  const { profile, user } = useAuth();
  const [filter, setFilter] = useState<QAFilterValue>('all');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [taskItem, setTaskItem] = useState<QAItemDef | null>(null);

  const stats = useMemo(
    () => (row ? computeProgress(row.template_snapshot, row.checked_items) : null),
    [row],
  );

  if (loading || !row) {
    return <div className="p-8 text-center text-muted-foreground" dir="rtl">טוען בדיקה...</div>;
  }

  const readOnly = row.status === 'approved' || row.status === 'rejected';
  const reviewerName = row.created_by_name || profile?.full_name || user?.email || '';

  const handleApprove = async () => {
    setApproving(true);
    try {
      const result = await approve();
      toast({
        title: 'הבדיקה אושרה!',
        description: result?.created
          ? 'נוצר קמפיין חדש בסטטוס Active והופיע גם במודעות.'
          : 'הקמפיין הקיים עודכן לסטטוס Active.',
      });
    } catch (e: any) {
      toast({ title: 'שגיאה באישור', description: e.message, variant: 'destructive' });
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('לסמן את הבדיקה ככשל? לא ניתן יהיה להעלות לאוויר ממנה.')) return;
    setRejecting(true);
    try {
      await reject();
      toast({ title: 'הבדיקה סומנה ככשל', description: 'הסטטוס נשמר בהיסטוריה.' });
    } catch (e: any) {
      toast({ title: 'שגיאה', description: e.message, variant: 'destructive' });
    } finally {
      setRejecting(false);
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
                adName: row.ad_name ?? '',
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
        adName={row.ad_name ?? ''}
        onAdName={() => {}}
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
            onCreateTask={(item) => setTaskItem(item)}
          />
        ))}
      </div>

      {row.status !== 'approved' && row.status !== 'rejected' && stats && (
        <QASubmitButton
          criticalDone={stats.criticalDone}
          criticalTotal={stats.criticalTotal}
          onApprove={handleApprove}
          onReject={handleReject}
          approving={approving}
          rejecting={rejecting}
        />
      )}

      <CreateTaskFromQADialog
        open={!!taskItem}
        onOpenChange={(v) => !v && setTaskItem(null)}
        qaRow={row}
        presetTitle={
          taskItem
            ? `QA: ${row.campaign_name}${row.ad_name ? ` — ${row.ad_name}` : ''} — ${taskItem.text}`
            : undefined
        }
        presetDescription={
          taskItem
            ? `נוצר מפריט QA: "${taskItem.text}"${row.ad_name ? ` (מודעה: ${row.ad_name})` : ''}`
            : undefined
        }
      />
    </div>
  );
}