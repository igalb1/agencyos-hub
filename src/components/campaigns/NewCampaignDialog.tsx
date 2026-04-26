import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrgData } from '@/hooks/useOrgData';
import { Campaign, Platform, CampaignStatus } from '@/lib/types';
import { Lang } from '@/lib/i18n';
import { toast } from 'sonner';

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: Lang;
  onCampaignCreated: (campaign: Campaign) => void;
}

const platforms: Platform[] = ['Meta', 'Google', 'TikTok', 'LinkedIn'];
const statuses: CampaignStatus[] = ['Live', 'Planned', 'Paused'];

export default function NewCampaignDialog({ open, onOpenChange, lang, onCampaignCreated }: NewCampaignDialogProps) {
  const { clients, projects } = useOrgData();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [platform, setPlatform] = useState<Platform>('Meta');
  const [status, setStatus] = useState<CampaignStatus>('Planned');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredProjects = projects.filter(p => p.clientId === clientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientId || !projectId || !budget) {
      toast.error(lang === 'he' ? 'נא למלא את כל השדות' : 'Please fill all required fields');
      return;
    }
    const client = clients.find(c => c.id === clientId);
    const project = projects.find(p => p.id === projectId);
    const newCampaign: Campaign = {
      id: `new-${Date.now()}`,
      clientId,
      clientName: client?.name || '',
      projectId,
      projectName: project?.name || '',
      name,
      platform,
      status,
      budget: Number(budget),
      spend: 0,
      leads: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date().toISOString().slice(0, 10),
      budgetAlertThreshold: 80,
    };
    onCampaignCreated(newCampaign);
    toast.success(lang === 'he' ? `קמפיין "${name}" נוצר בהצלחה` : `Campaign "${name}" created successfully`);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setClientId('');
    setProjectId('');
    setPlatform('Meta');
    setStatus('Planned');
    setBudget('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {lang === 'he' ? 'קמפיין חדש' : 'New Campaign'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>{lang === 'he' ? 'שם קמפיין' : 'Campaign Name'}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'he' ? 'לדוגמה: Meta Brand Q2' : 'e.g. Meta Brand Q2'} />
          </div>

          {/* Client + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'לקוח' : 'Client'}</Label>
              <Select value={clientId} onValueChange={v => { setClientId(v); setProjectId(''); }}>
                <SelectTrigger><SelectValue placeholder={lang === 'he' ? 'בחר לקוח' : 'Select client'} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'פרויקט' : 'Project'}</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder={lang === 'he' ? 'בחר פרויקט' : 'Select project'} /></SelectTrigger>
                <SelectContent>
                  {filteredProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Platform + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'פלטפורמה' : 'Platform'}</Label>
              <Select value={platform} onValueChange={v => setPlatform(v as Platform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'סטטוס' : 'Status'}</Label>
              <Select value={status} onValueChange={v => setStatus(v as CampaignStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label>{lang === 'he' ? 'תקציב (₪)' : 'Budget ($)'}</Label>
            <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="10000" />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'תאריך התחלה' : 'Start Date'}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'he' ? 'תאריך סיום' : 'End Date'}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {lang === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
            <Button type="submit">
              {lang === 'he' ? 'צור קמפיין' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
